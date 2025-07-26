import * as bip39 from "bip39";
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from "@solana/web3.js";
const mnemonic = "pill tomorrow foster begin walnut borrow virtual kick shift mutual shoe scatter";
const seed = bip39.mnemonicToSeedSync(mnemonic, "");
const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;

const keypair = Keypair.fromSeed(derivedSeed);

console.log(keypair.publicKey.toBase58());
