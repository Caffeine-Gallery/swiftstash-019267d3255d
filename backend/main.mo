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

actor {
  type FileInfo = {
    name: Text;
    contentType: Text;
    chunkCount: Nat;
  };

  type FileChunk = {
    data: Blob;
  };

  stable var fileInfoEntries : [(Text, FileInfo)] = [];
  stable var fileChunkEntries : [(Text, [FileChunk])] = [];

  var fileInfos = HashMap.HashMap<Text, FileInfo>(0, Text.equal, Text.hash);
  var fileChunks = HashMap.HashMap<Text, [FileChunk]>(0, Text.equal, Text.hash);

  public func uploadFileChunk(name: Text, contentType: Text, chunkIndex: Nat, totalChunks: Nat, data: [Nat8]) : async () {
    let chunk : FileChunk = { data = Blob.fromArray(data) };
    
    switch (fileChunks.get(name)) {
      case (null) {
        let newChunks = Array.init<FileChunk>(totalChunks, chunk);
        newChunks[chunkIndex] := chunk;
        fileChunks.put(name, Array.freeze(newChunks));
        fileInfos.put(name, { name = name; contentType = contentType; chunkCount = totalChunks });
      };
      case (?existingChunks) {
        let updatedChunks = Array.thaw<FileChunk>(existingChunks);
        updatedChunks[chunkIndex] := chunk;
        fileChunks.put(name, Array.freeze(updatedChunks));
      };
    };
  };

  public query func getFileInfo(name: Text) : async ?FileInfo {
    switch (fileInfos.get(name)) {
      case (?info) {
        ?{
          name = info.name;
          contentType = Option.get(Text.stripStart(info.contentType, #text ""), "application/octet-stream");
          chunkCount = info.chunkCount;
        }
      };
      case (null) { null };
    }
  };

  public query func getFileChunk(name: Text, chunkIndex: Nat) : async ?Blob {
    switch (fileChunks.get(name)) {
      case (null) { null };
      case (?chunks) {
        if (chunkIndex < chunks.size()) {
          ?chunks[chunkIndex].data
        } else {
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
