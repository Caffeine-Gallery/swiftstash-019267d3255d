import type { Principal } from '@dfinity/principal';
import type { ActorMethod } from '@dfinity/agent';
import type { IDL } from '@dfinity/candid';

export interface FileInfo {
  'content' : Uint8Array | number[],
  'contentType' : string,
  'name' : string,
}
export interface _SERVICE {
  'deleteFile' : ActorMethod<[string], undefined>,
  'getFileContent' : ActorMethod<[string], [] | [Uint8Array | number[]]>,
  'getFileInfo' : ActorMethod<[string], [] | [FileInfo]>,
  'listFiles' : ActorMethod<[], Array<string>>,
  'uploadFile' : ActorMethod<[string, string, Uint8Array | number[]], string>,
}
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
