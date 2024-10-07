import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface File {
  'data' : Uint8Array | number[],
  'name' : string,
  'content_type' : string,
}
export interface _SERVICE {
  'getFile' : ActorMethod<[string], [] | [File]>,
  'listFiles' : ActorMethod<[], Array<string>>,
  'uploadFileChunk' : ActorMethod<
    [string, string, Uint8Array | number[], bigint, bigint],
    bigint
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
