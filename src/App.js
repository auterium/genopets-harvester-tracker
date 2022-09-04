import React, { useReducer, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from "@metaplex-foundation/js";
import { Program, AnchorProvider } from '@project-serum/anchor';
import idl from './genopets_idl';
import './App.css';

const connection = new Connection('https://solana-api.projectserum.com');
const metaplex = Metaplex.make(connection);
const programId = new PublicKey('HAbiTatJVqoCJd9asyr6RxMEdwtfrQugwp7VAFyKWb1g');
const provider = new AnchorProvider(connection, { publicKey: PublicKey.default });
const habitatManager = new Program(idl, programId, provider);

const formReducer = (state, event) => {
  return {
    ...state,
    [event.name]: event.value,
  };
}

function App() {
  const [formData, setFormData] = useReducer(formReducer, {});
  const [searching, setSearching] = useState(false);
  const [pendingHarvests, setPendingHarvests] = useState([]);
  const [tenants, setTenants] = useState({});
  const [habitats, setHabitats] = useState({});

  const handleSumbit = async (event) => {
    event.preventDefault();

    try {
      const landlordKey = new PublicKey(formData.landlord);

      setSearching(true);
      setPendingHarvests([]);
      setTenants({});

      // Fetch all NFTs owned
      const nfts = await metaplex.nfts().findAllByOwner({ owner: landlordKey }).run();
      // Convert results into a dictionary that only includes habitats
      const habitats = nfts.reduce((agg, nft) => {
        if(nft.symbol === 'HABITAT') {
          agg[nft.mintAddress.toBase58()] = nft;
        }

        return agg;
      }, {});

      // Compute the game data derived keys
      const habitatKeys = nfts
        .filter(nft => nft.symbol === 'HABITAT')
        .map(nft => PublicKey.findProgramAddressSync(["habitat-data", nft.mintAddress.toBuffer()], programId)[0]);

      // Fetch game data for the habitats
      const habitatDatas = await habitatManager.account.habitatData.fetchMultiple(habitatKeys);

      for (const habitatData of habitatDatas) {
        habitats[habitatData.habitatMint.toBase58()].habitatData = habitatData;
      }

      const lockedKiEntries = await habitatManager.account.lockedKi.all([
        { dataSize: 1040 },
        { memcmp: { offset: 110, bytes: formData.landlord } },
      ]);

      const pendingHarvests = [];
      const tenants = {};
      const tenantPlayerDataKeys = [];

      for (const { publicKey, account } of lockedKiEntries) {
        const player = account.player.toBase58();
        const landlord = account.landlord.toBase58();
        const amount = account.amount.toNumber() / 10**9;
        const startTime = new Date(account.startTimestamp.toNumber() * 1000);
        const royaltyRate = account.royaltyRateBips / 10000;
        const habitatKey = account.habitat.toBase58();

        let habitat = habitatKey.substring(0, 8) + '...';
        if (habitats[habitatKey]) {
          habitat = habitats[habitatKey].name;
        }

        let harvesterKi = 0;
        let landlordKi = 0;

        if (player === landlord) {
          landlordKi = amount;
        } else {
          if (!tenants[player]) {
            tenants[player] = {
              pendingKi: 0,
              lastHarvest: startTime,
            };

            tenantPlayerDataKeys.push(PublicKey.findProgramAddressSync(["player-data", account.player.toBuffer()], programId)[0]);
          }

          harvesterKi = amount * (1 - royaltyRate);
          landlordKi = amount * royaltyRate;

          tenants[player].pendingKi += harvesterKi;
          if (tenants[player].lastHarvest < startTime) {
            tenants[player].lastHarvest = startTime;
          }
        }

        pendingHarvests.push({
          id: publicKey.toBase58(),
          player,
          startTime,
          endTime: new Date(account.endTimestamp.toNumber() * 1000),
          amount,
          harvesterKi,
          landlordKi,
          habitat,
        });
      }

      pendingHarvests.sort((a, b) => a.endTime > b.endTime ? 1 : b.endTime > a.endTime ? -1 : 0);

      const playerDataEntries = await habitatManager.account.playerData.fetchMultiple(tenantPlayerDataKeys);

      for (const { player, active, banned, lastHarvestTimestamp } of playerDataEntries) {
        Object.assign(tenants[player.toBase58()], {
          active,
          banned,
          lastHarvest2: new Date(lastHarvestTimestamp.toNumber() * 1000),
        });
      }

      setPendingHarvests(pendingHarvests);
      setTenants(tenants);
      setHabitats(habitats);
    } catch(e) {
      alert(e);
    } finally {
      setSearching(false);
    }
  };

  const handleChange = event => {
    setFormData({
      name: event.target.name,
      value: event.target.value,
    });
  };

  const humanDate = date => date.toISOString().substring(0, 16).replace('T', ' ') + ' UTC';

  return (
    <div className="wrapper">
      <form onSubmit={handleSumbit}>
        <h1>Genopets harvests tracker</h1>
        <fieldset>
          <label>
            <p>Landlord address</p>
            <input name='landlord' onChange={handleChange} />
          </label>
        </fieldset>
        <button type="submit">Submit</button>
      </form>
      {searching && <div>Fetching harvests</div>}
      <div>
        <h2>Habitats</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Level</th>
              <th>Element</th>
              <th>Expiry timestamp (end of lifespan)</th>
              <th>Harvester</th>
              <th>Harvester royalty</th>
              <th>Total KI harvested</th>
              <th>Durability</th>
              <th>Habitats terraformed</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(habitats).sort(([, a], [, b]) => a.name > b.name ? 1 : a.name < b.name ? -1 : 0).map(([id, { name, habitatData }], i) => (
              <tr key={ id }>
                <td>{ i + 1 }</td>
                <td>{ name }</td>
                <td>{ habitatData.level }</td>
                <td>{ habitatData.element }</td>
                <td>{ humanDate(new Date(habitatData.expiryTimestamp * 1000)) }</td>
                <td>{ new PublicKey(habitatData.harvester).toBase58() !== PublicKey.default.toBase58() && new PublicKey(habitatData.harvester).toBase58().substring(0, 8) + '...' }</td>
                <td>{ parseFloat((habitatData.harvesterRoyaltyBips / 100).toFixed(2)) }%</td>
                <td>{ parseFloat((habitatData.totalKiHarvested.toNumber() / 10**9).toFixed(2)) }</td>
                <td>{ habitatData.durability }</td>
                <td>{ habitatData.habitatsTerraformed }</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h2>Tenants</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Pending KI</th>
              <th>Banned</th>
              <th>Active</th>
              <th>Last harvest for selected landlord</th>
              <th>Last harvest</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(tenants).map(([id, data], i) => (
              <tr key={ id }>
                <td>{ i + 1 }</td>
                <td>{ id.substring(0, 8) }...</td>
                <td>{ parseFloat(data.pendingKi.toFixed(2)) }</td>
                <td>{ data.banned ? 'Yes' : 'No' }</td>
                <td>{ data.active ? 'Yes' : 'No' }</td>
                <td>{ data.lastHarvest.toISOString().substring(0, 16).replace('T', ' ') } UTC</td>
                <td>{ data.lastHarvest2.toISOString().substring(0, 16).replace('T', ' ') } UTC</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h2>Pending harvests</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>KI amount</th>
              <th>Harvester's KI</th>
              <th>Landlord's KI</th>
              <th>Habitat</th>
              <th>Harvest date</th>
              <th>Claim date</th>
            </tr>
          </thead>
          <tbody>
            {pendingHarvests.map(({ id, player, startTime, endTime, amount, harvesterKi, landlordKi, habitat }, i) => (
              <tr key={ id }>
                <td>{ i + 1 }</td>
                <td>{ player.substring(0, 8) }...</td>
                <td>{ parseFloat(amount.toFixed(2)) }</td>
                <td>{ parseFloat(harvesterKi.toFixed(2)) }</td>
                <td>{ parseFloat(landlordKi.toFixed(2)) }</td>
                <td>{ habitat }</td>
                <td>{ startTime.toISOString().substring(0, 16).replace('T', ' ') } UTC</td>
                <td>{ endTime.toISOString().substring(0, 16).replace('T', ' ') } UTC</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={4}>Pending landlord KI</th>
              <th>{parseFloat(pendingHarvests.reduce((agg, { landlordKi }) => agg + landlordKi, 0).toFixed(2))}</th>
              <th colSpan={3}>&nbsp;</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default App;
