import React, { useReducer, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from "@metaplex-foundation/js";
import { LockedKi } from './Models';
import './App.css';

const connection = new Connection('https://solana-api.projectserum.com');
const metaplex = Metaplex.make(connection);
const programId = new PublicKey('HAbiTatJVqoCJd9asyr6RxMEdwtfrQugwp7VAFyKWb1g');

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

  const handleSumbit = async (event) => {
    event.preventDefault();

    try {
      const landlordKey = new PublicKey(formData.landlord);
      setSearching(true);

      // Fetch all NFTs owned
      const nfts = await metaplex.nfts().findAllByOwner({ owner: landlordKey }).run();
      // Convert results into a dictionary that only includes habitats
      const habitats = nfts.reduce((agg, nft) => {
        if(nft.symbol === 'HABITAT') {
          agg[nft.mintAddress.toBase58()] = nft;
        }

        return agg;
      }, {});

      // Fetch all locked KI accounts for the landlord
      const accounts = await connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: LockedKi.LEN },
          { memcmp: { offset: 110, bytes: formData.landlord } },
        ],
      });

      // Convert locked KI accounts into the expected formats
      const harvests = accounts
        .map(({ account, pubkey }) => {
          const { habitat, ...rest } = LockedKi.deserialize(account.data);
          const habitatAddress = habitat.toBase58();

          return {
            id: pubkey.toBase58(),
            // Get the habitat name from the list of habitats if available. Fallback to the address
            habitat: (habitats[habitatAddress] || { name: habitatAddress.substring(0, 8) + '...'}).name,
            ...rest
          };
        })
        // Sort pending harvests by the end date ascending
        .sort((a, b) => a.endTimestamp > b.endTimestamp ? 1 : b.endTimestamp > a.endTimestamp ? -1 : 0);

      setPendingHarvests(harvests);
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
      <table>
        <thead>
          <tr>
            <th>&nbsp;</th>
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
          {pendingHarvests.map(({ id, player, startTimestamp, endTimestamp, amount, habitat, royaltyRateBips }, i) => (
            <tr key={ id }>
              <td>{ i + 1 }</td>
              <td>{ player.toBase58().substr(0, 8) }...</td>
              <td>{ amount }</td>
              <td>{ amount * (10000 - royaltyRateBips) / 10000 } ({ (10000 - royaltyRateBips) / 100 }%)</td>
              <td>{ amount * royaltyRateBips / 10000 } ({ royaltyRateBips / 100 }%)</td>
              <td>{ habitat }</td>
              <td>{ startTimestamp.toISOString() }</td>
              <td>{ endTimestamp.toISOString() }</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
