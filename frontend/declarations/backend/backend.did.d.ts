import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface FileInfo {
  'contentType' : string,
  'name' : string,
  'chunkCount' : bigint,
}
export interface _SERVICE {
  'getFileChunk' : ActorMethod<[string, bigint], [] | [Uint8Array | number[]]>,
  'getFileInfo' : ActorMethod<[string], [] | [FileInfo]>,
  'listFiles' : ActorMethod<[], Array<string>>,
  'uploadFileChunk' : ActorMethod<
    [string, string, bigint, bigint, Uint8Array | number[]],
    undefined
  >,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
