import Bool "mo:base/Bool";
import Hash "mo:base/Hash";
import Int "mo:base/Int";
import Nat8 "mo:base/Nat8";

import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Option "mo:base/Option";
import Text "mo:base/Text";
import Error "mo:base/Error";

actor {
  type FileInfo = {
    name: Text;
    contentType: Text;
    chunkCount: Nat64;
    size: Nat64;
  };

  type FileChunk = {
    data: Blob;
  };

  stable var fileInfoEntries : [(Text, FileInfo)] = [];
  stable var fileChunkEntries : [(Text, [FileChunk])] = [];

  var fileInfos = HashMap.HashMap<Text, FileInfo>(0, Text.equal, Text.hash);
  var fileChunks = HashMap.HashMap<Text, [FileChunk]>(0, Text.equal, Text.hash);

  public func uploadFileChunk(name: Text, contentType: Text, totalSize: Nat64, chunkIndex: Nat64, totalChunks: Nat64, data: [Nat8]) : async () {
    if (data.size() == 0) {
      throw Error.reject("Cannot upload empty chunk");
    };

    let chunk : FileChunk = { data = Blob.fromArray(data) };
    
    switch (fileChunks.get(name)) {
      case (null) {
        if (totalSize == 0) {
          throw Error.reject("Cannot upload file with 0 bytes");
        };
        let newChunks = Array.init<FileChunk>(Nat64.toNat(totalChunks), chunk);
        newChunks[Nat64.toNat(chunkIndex)] := chunk;
        fileChunks.put(name, Array.freeze(newChunks));
        fileInfos.put(name, { name = name; contentType = contentType; chunkCount = totalChunks; size = totalSize });
      };
      case (?existingChunks) {
        let updatedChunks = Array.thaw<FileChunk>(existingChunks);
        updatedChunks[Nat64.toNat(chunkIndex)] := chunk;
        fileChunks.put(name, Array.freeze(updatedChunks));
      };
    };

    Debug.print("Uploaded chunk " # Nat64.toText(chunkIndex) # " of " # Nat64.toText(totalChunks) # " for file " # name # " (Total size: " # Nat64.toText(totalSize) # " bytes)");
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

  public query func getFileChunk(name: Text, chunkIndex: Nat64) : async ?Blob {
    switch (fileChunks.get(name)) {
      case (null) { 
        Debug.print("File not found: " # name);
        null 
      };
      case (?chunks) {
        let index = Nat64.toNat(chunkIndex);
        if (index < chunks.size()) {
          let chunkData = chunks[index].data;
          if (chunkData.size() == 0) {
            Debug.print("Warning: Empty chunk detected for file " # name # " at index " # Nat64.toText(chunkIndex));
          };
          Debug.print("Returning chunk " # Nat64.toText(chunkIndex) # " of file " # name # " with size " # Nat.toText(chunkData.size()));
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

  public query func verifyFileIntegrity(name: Text) : async Bool {
    switch (fileInfos.get(name), fileChunks.get(name)) {
      case (?info, ?chunks) {
        let actualChunkCount = chunks.size();
        let expectedChunkCount = Nat64.toNat(info.chunkCount);
        let actualSize = Array.foldLeft<FileChunk, Nat64>(chunks, 0, func (acc, chunk) { acc + Nat64.fromNat(chunk.data.size()) });
        
        if (actualChunkCount != expectedChunkCount) {
          Debug.print("Chunk count mismatch for file " # name # ". Expected: " # Nat.toText(expectedChunkCount) # ", Actual: " # Nat.toText(actualChunkCount));
          return false;
        };

        if (actualSize != info.size) {
          Debug.print("File size mismatch for file " # name # ". Expected: " # Nat64.toText(info.size) # ", Actual: " # Nat64.toText(actualSize));
          return false;
        };

        true
      };
      case _ {
        Debug.print("File not found: " # name);
        false
      };
    }
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
