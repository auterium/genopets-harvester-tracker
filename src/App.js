import React, { useReducer, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { deserializeUnchecked } from 'borsh';
import './App.css';

const connection = new Connection('https://solana-api.projectserum.com');
const programId = new PublicKey('HAbiTatJVqoCJd9asyr6RxMEdwtfrQugwp7VAFyKWb1g');

class PlayerData {
  static LEN = 166;
  static schema = new Map([[PlayerData, {
    kind: "struct",
    fields: [
      ["player", [32]],
      ["gameAccountUid", [32]],
      ["totalKiWithdrawn", "u64"],
      ["totalEnergyConverted", "u64"],
      ["currentLockedKiIndex", "u32"],
      ["activeHabitat", [32]],
      ["banned", "u8"],
      ["active", "u8"],
      ["lastHarvestTimestamp", "u64"],
      ["nextHarvestTimestamp", "u64"],
      ["durableNonceAccount", [32]]
    ]
  }]]);

  constructor(args) {
    this.player = new PublicKey(args.player);
    this.gameAccountUid = args.gameAccountUid;
    this.totalKiWithdrawn = args.totalKiWithdrawn.toNumber();
    this.totalEnergyConverted = args.totalEnergyConverted.toNumber();
    this.currentLockedKiIndex = args.currentLockedKiIndex;
    this.activeHabitat = new PublicKey(args.activeHabitat);
    this.banned = args.banned;
    this.active = args.active;
    this.lastHarvestTimestamp = new Date(args.lastHarvestTimestamp.toNumber() * 1000);
    this.nextHarvestTimestamp = new Date(args.nextHarvestTimestamp.toNumber() * 1000);
    this.durableNonceAccount = new PublicKey(args.durableNonceAccount);
  }

  static deserialize(data) {
    return deserializeUnchecked(this.schema, PlayerData, data.subarray(8));
  }
}

class LockedKi {
  static LEN = 1000;
  static schema = new Map([[LockedKi, {
    kind: "struct",
    fields: [
      ["player", [32]],
      ["startTimestamp", "u64"],
      ["endTimestamp", "u64"],
      ["amount", "u64"],
      ["habitat", [32]],
      ["energyConverted", "u64"],
      ["indexId", "u32"],
      ["royaltyRateBips", "u16"],
      ["landlord", [32]],
    ]
  }]]);

  constructor(args) {
    this.player = new PublicKey(args.player);
    this.startTimestamp = new Date(args.startTimestamp.toNumber() * 1000);
    this.endTimestamp = new Date(args.endTimestamp.toNumber() * 1000);
    this.amount = args.amount.toNumber() / 10**9;
    this.habitat = new PublicKey(args.habitat);
    this.energyConverted = args.energyConverted.toNumber();
    this.royaltyRateBips = args.royaltyRateBips;
  }

  static deserialize(data) {
    return deserializeUnchecked(this.schema, LockedKi, data.subarray(8));
  }
}

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
  const [harvester, setHarvester] = useState(null);

  const handleSumbit = async (event) => {
    event.preventDefault();

    try {
      const harvesterKey = new PublicKey(formData.harvester);
      setSearching(true);

      const [playerDataAddress] = await PublicKey.findProgramAddress(["player-data", harvesterKey.toBuffer()], programId);
      const accountInfo = await connection.getAccountInfo(playerDataAddress);

      const playerData = PlayerData.deserialize(accountInfo.data);
      setHarvester(playerData);

      const kiHarvestAddresses = [];
      for(let i = playerData.currentLockedKiIndex; i > 0; --i) {
        const buf = Buffer.alloc(4);
        buf.writeUint32LE(i - 1, 0);
        const [kiHarvestAddress] = await PublicKey.findProgramAddress(["locked-ki", harvesterKey.toBuffer(), buf], programId);
        kiHarvestAddresses.push(kiHarvestAddress);
      }

      const accountInfos = await connection.getMultipleAccountsInfo(kiHarvestAddresses);
      const harvests = accountInfos.filter(e => !!e).map(({ data }) => LockedKi.deserialize(data)).reverse();

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
        <h1>Ugly harvester tracker</h1>
        <fieldset>
          <label>
            <p>Havester address</p>
            <input name='harvester' onChange={handleChange} />
          </label>
        </fieldset>
        <button type="submit">Submit</button>
      </form>
      {searching && <div>Fetching harvests</div>}
      {harvester && <ul>
        <li>Player: {harvester.player.toBase58().substr(0, 8)}...</li>
        <li>Total energy converted: {harvester.totalEnergyConverted}</li>
        <li>Active habitat: {harvester.activeHabitat.toBase58().substr(0, 8)}...</li>
        <li>Banned: {harvester.banned ? 'Yes' : 'No'}</li>
        <li>Active: {harvester.active ? 'Yes' : 'No'}</li>
        <li>Last harvest: {harvester.lastHarvestTimestamp.toISOString()}</li>
      </ul>}
      <table>
        <thead>
          <tr>
            <th>KI amount</th>
            <th>Harvester's KI</th>
            <th>Landlord's KI</th>
            <th>Habitat</th>
            <th>Harvest date</th>
            <th>Claim date</th>
          </tr>
        </thead>
        <tbody>
          {pendingHarvests.map(({ startTimestamp, endTimestamp, amount, habitat, royaltyRateBips }, id) => (
            <tr key={ id }>
              <td>{ amount }</td>
              <td>{ amount * (10000 - royaltyRateBips) / 10000 } ({ (10000 - royaltyRateBips) / 100 }%)</td>
              <td>{ amount * royaltyRateBips / 10000 } ({ royaltyRateBips / 100 }%)</td>
              <td>{ habitat.toBase58().substr(0, 8) }...</td>
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
