import { PublicKey } from '@solana/web3.js';
import { deserializeUnchecked } from 'borsh';

export class PlayerData {
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

export class LockedKi {
  static LEN = 1040;
  static SCHEMA = new Map([[LockedKi, {
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
    return deserializeUnchecked(this.SCHEMA, LockedKi, data.subarray(8));
  }
}

// export class HabitatData {
//   static schema = new Map([[HabitatData, {
//     kind: "struct",
//     fields: [
//       ["habitatMint", [32]],
//       ["level", "u8"],
//       ["element", "u8"],
//       ["genesis", "u8"],
//       ["renewalTimestamp", "u64"],
//       ["expiryTimestamp", "u64"],
//       ["nextDayTimestamp", "u64"],
//       ["cyrstalsRefined", "u8"],
//       ["harvester", [32]],
//       //...
//     ]
//   }]]);

//   constructor(args) {
//     this.habitatMint = new PublicKey(args.habitatMint);
//   }
// }
