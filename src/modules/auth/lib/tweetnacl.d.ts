// Local ambient declaration for tweetnacl. The upstream package ships its own `nacl.d.ts` once installed; this fallback only declares the subset we use so the project keeps typechecking in environments where `node_modules` has not been hydrated yet (CI lint stages, sandboxed agents).
declare module "tweetnacl" {
  export interface SignKeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
  }

  export interface SignFunctions {
    detached(message: Uint8Array, secretKey: Uint8Array): Uint8Array;
    keyPair: {
      (): SignKeyPair;
      fromSeed(seed: Uint8Array): SignKeyPair;
      fromSecretKey(secretKey: Uint8Array): SignKeyPair;
    };
  }

  export interface SignDetached {
    verify(
      message: Uint8Array,
      signature: Uint8Array,
      publicKey: Uint8Array,
    ): boolean;
  }

  export interface NaclSign extends SignFunctions {
    detached: ((message: Uint8Array, secretKey: Uint8Array) => Uint8Array) &
      SignDetached;
  }

  export interface Nacl {
    sign: NaclSign;
    setPRNG(prng: (bytes: Uint8Array, length: number) => void): void;
  }

  const nacl: Nacl;
  export default nacl;
}
