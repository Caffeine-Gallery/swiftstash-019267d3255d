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
  var fileChunks = HashMap.HashMap<Text, Buffer.Buffer<FileChunk>>(0, Text.equal, Text.hash);

  public func uploadFileChunk(name: Text, contentType: Text, totalSize: Nat64, chunkIndex: Nat64, totalChunks: Nat64, data: [Nat8]) : async Text {
    if (data.size() == 0) {
      Debug.print("Error: Received empty chunk for file " # name # " at index " # Nat64.toText(chunkIndex));
      return "Error: Cannot upload empty chunk";
    };

    let chunk : FileChunk = { data = Blob.fromArray(data) };
    
    switch (fileChunks.get(name)) {
      case (null) {
        if (totalSize == 0) {
          Debug.print("Error: Attempted to upload file " # name # " with 0 bytes");
          return "Error: Cannot upload file with 0 bytes";
        };
        let newChunks = Buffer.Buffer<FileChunk>(Nat64.toNat(totalChunks));
        newChunks.add(chunk);
        fileChunks.put(name, newChunks);
        fileInfos.put(name, { name = name; contentType = contentType; chunkCount = totalChunks; size = totalSize });
      };
      case (?existingChunks) {
        if (Nat64.toNat(chunkIndex) == existingChunks.size()) {
          existingChunks.add(chunk);
        } else if (Nat64.toNat(chunkIndex) < existingChunks.size()) {
          existingChunks.put(Nat64.toNat(chunkIndex), chunk);
        } else {
          Debug.print("Error: Invalid chunk index " # Nat64.toText(chunkIndex) # " for file " # name);
          return "Error: Invalid chunk index";
        };
      };
    };

    Debug.print("Uploaded chunk " # Nat64.toText(chunkIndex) # " of " # Nat64.toText(totalChunks) # " for file " # name # " (Chunk size: " # Nat.toText(data.size()) # " bytes)");
    return "Success: Chunk uploaded";
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

  public query func getFileChunk(name: Text, chunkIndex: Nat64) : async ?[Nat8] {
    switch (fileChunks.get(name)) {
      case (null) { 
        Debug.print("File not found: " # name);
        null 
      };
      case (?chunks) {
        let index = Nat64.toNat(chunkIndex);
        if (index < chunks.size()) {
          let chunkData = chunks.get(index).data;
          let chunkArray = Blob.toArray(chunkData);
          if (chunkArray.size() == 0) {
            Debug.print("Warning: Empty chunk detected for file " # name # " at index " # Nat64.toText(chunkIndex));
            null
          } else {
            Debug.print("Returning chunk " # Nat64.toText(chunkIndex) # " of file " # name # " with size " # Nat.toText(chunkArray.size()) # " bytes");
            ?chunkArray
          }
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

  public func deleteFile(name: Text) : async () {
    switch (fileInfos.get(name)) {
      case (?_) {
        fileInfos.delete(name);
        fileChunks.delete(name);
        Debug.print("File deleted: " # name);
      };
      case (null) {
        Debug.print("File not found for deletion: " # name);
        throw Error.reject("File not found");
      };
    };
  };

  public query func verifyFileIntegrity(name: Text) : async Bool {
    switch (fileInfos.get(name), fileChunks.get(name)) {
      case (?info, ?chunks) {
        let actualChunkCount = chunks.size();
        let expectedChunkCount = Nat64.toNat(info.chunkCount);
        if (actualChunkCount != expectedChunkCount) {
          Debug.print("Integrity check failed for file " # name # ": Chunk count mismatch");
          return false;
        };
        var totalSize : Nat64 = 0;
        for (chunk in chunks.vals()) {
          totalSize += Nat64.fromNat(chunk.data.size());
        };
        if (totalSize != info.size) {
          Debug.print("Integrity check failed for file " # name # ": Size mismatch");
          return false;
        };
        Debug.print("Integrity check passed for file " # name);
        true
      };
      case _ {
        Debug.print("Integrity check failed: File not found " # name);
        false
      };
    }
  };

  public query func debugFileChunks(name: Text) : async Text {
    switch (fileChunks.get(name)) {
      case (null) { "File not found: " # name };
      case (?chunks) {
        var debugInfo = "File: " # name # "\n";
        debugInfo #= "Total chunks: " # Nat.toText(chunks.size()) # "\n";
        for (i in Iter.range(0, chunks.size() - 1)) {
          let chunk = chunks.get(i);
          debugInfo #= "Chunk " # Nat.toText(i) # " size: " # Nat.toText(chunk.data.size()) # " bytes\n";
        };
        debugInfo
      };
    }
  };

  public query func getFileContent(name: Text) : async ?[Nat8] {
    switch (fileChunks.get(name)) {
      case (null) {
        Debug.print("File not found: " # name);
        null
      };
      case (?chunks) {
        var content = Buffer.Buffer<Nat8>(0);
        for (chunk in chunks.vals()) {
          for (byte in Blob.toArray(chunk.data).vals()) {
            content.add(byte);
          };
        };
        Debug.print("Retrieved file content for " # name # " with size: " # Nat.toText(content.size()) # " bytes");
        ?Buffer.toArray(content)
      };
    }
  };

  system func preupgrade() {
    fileInfoEntries := Iter.toArray(fileInfos.entries());
    
    let tempChunkEntries = Buffer.Buffer<(Text, [FileChunk])>(fileChunks.size());
    for ((name, chunkBuffer) in fileChunks.entries()) {
      tempChunkEntries.add((name, Buffer.toArray(chunkBuffer)));
    };
    fileChunkEntries := Buffer.toArray(tempChunkEntries);
  };

  system func postupgrade() {
    fileInfos := HashMap.fromIter<Text, FileInfo>(fileInfoEntries.vals(), 0, Text.equal, Text.hash);
    
    fileChunks := HashMap.HashMap<Text, Buffer.Buffer<FileChunk>>(0, Text.equal, Text.hash);
    for ((name, chunks) in fileChunkEntries.vals()) {
      fileChunks.put(name, Buffer.fromArray<FileChunk>(chunks));
    };
  };
}
