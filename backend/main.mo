import Hash "mo:base/Hash";
import Nat8 "mo:base/Nat8";

import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Option "mo:base/Option";
import Text "mo:base/Text";
import Error "mo:base/Error";

actor {
  type FileInfo = {
    name: Text;
    contentType: Text;
    chunkCount: Nat;
    size: Nat;
  };

  type FileChunk = {
    data: Blob;
  };

  stable var fileInfoEntries : [(Text, FileInfo)] = [];
  stable var fileChunkEntries : [(Text, [FileChunk])] = [];

  var fileInfos = HashMap.HashMap<Text, FileInfo>(0, Text.equal, Text.hash);
  var fileChunks = HashMap.HashMap<Text, [FileChunk]>(0, Text.equal, Text.hash);

  public func uploadFileChunk(name: Text, contentType: Text, totalSize: Nat, chunkIndex: Nat, totalChunks: Nat, data: [Nat8]) : async () {
    if (data.size() == 0) {
      throw Error.reject("Cannot upload empty chunk");
    };

    let chunk : FileChunk = { data = Blob.fromArray(data) };
    
    switch (fileChunks.get(name)) {
      case (null) {
        if (totalSize == 0) {
          throw Error.reject("Cannot upload file with 0 bytes");
        };
        let newChunks = Array.init<FileChunk>(totalChunks, chunk);
        newChunks[chunkIndex] := chunk;
        fileChunks.put(name, Array.freeze(newChunks));
        fileInfos.put(name, { name = name; contentType = contentType; chunkCount = totalChunks; size = totalSize });
      };
      case (?existingChunks) {
        let updatedChunks = Array.thaw<FileChunk>(existingChunks);
        updatedChunks[chunkIndex] := chunk;
        fileChunks.put(name, Array.freeze(updatedChunks));
      };
    };

    Debug.print("Uploaded chunk " # Nat.toText(chunkIndex) # " of " # Nat.toText(totalChunks) # " for file " # name # " (Total size: " # Nat.toText(totalSize) # " bytes)");
  };

  public query func getFileInfo(name: Text) : async ?FileInfo {
    switch (fileInfos.get(name)) {
      case (?info) {
        if (info.size == 0) {
          Debug.print("Warning: File size is 0 for " # name);
        };
        ?{
          name = info.name;
          contentType = Option.get(Text.stripStart(info.contentType, #text ""), "application/octet-stream");
          chunkCount = info.chunkCount;
          size = info.size;
        }
      };
      case (null) { 
        Debug.print("File info not found for: " # name);
        null 
      };
    }
  };

  public query func getFileChunk(name: Text, chunkIndex: Nat) : async ?Blob {
    switch (fileChunks.get(name)) {
      case (null) { 
        Debug.print("File not found: " # name);
        null 
      };
      case (?chunks) {
        if (chunkIndex < chunks.size()) {
          let chunkData = chunks[chunkIndex].data;
          if (chunkData.size() == 0) {
            Debug.print("Warning: Empty chunk detected for file " # name # " at index " # Nat.toText(chunkIndex));
          };
          Debug.print("Returning chunk " # Nat.toText(chunkIndex) # " of file " # name # " with size " # Nat.toText(chunkData.size()));
          ?chunkData
        } else {
          Debug.print("Chunk index out of range for file " # name);
          null
        }
      };
    }
  };

  public query func listFiles() : async [Text] {
    Iter.toArray(fileInfos.keys())
  };

  system func preupgrade() {
    fileInfoEntries := Iter.toArray(fileInfos.entries());
    fileChunkEntries := Iter.toArray(fileChunks.entries());
  };

  system func postupgrade() {
    fileInfos := HashMap.fromIter<Text, FileInfo>(fileInfoEntries.vals(), 0, Text.equal, Text.hash);
    fileChunks := HashMap.fromIter<Text, [FileChunk]>(fileChunkEntries.vals(), 0, Text.equal, Text.hash);
  };
}
