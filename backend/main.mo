import Func "mo:base/Func";
import Hash "mo:base/Hash";

import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Debug "mo:base/Debug";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Text "mo:base/Text";

actor {
  // File type definition
  type File = {
    name: Text;
    content_type: Text;
    data: Blob;
  };

  // Stable variable to store files
  stable var fileEntries : [(Text, File)] = [];

  // Create a HashMap to store files
  var files = HashMap.HashMap<Text, File>(0, Text.equal, Text.hash);

  // Function to upload a file chunk
  public func uploadFileChunk(name: Text, content_type: Text, chunk: Blob, total_chunks: Nat, chunk_index: Nat) : async Nat {
    let existing_file = files.get(name);
    let updated_data = switch (existing_file) {
      case (null) chunk;
      case (?file) Blob.fromArray(Array.append(Blob.toArray(file.data), Blob.toArray(chunk)));
    };

    let file : File = {
      name = name;
      content_type = content_type;
      data = updated_data;
    };
    files.put(name, file);

    chunk_index + 1
  };

  // Function to retrieve a file
  public query func getFile(name: Text) : async ?File {
    files.get(name)
  };

  // Function to list all files
  public query func listFiles() : async [Text] {
    Iter.toArray(files.keys())
  };

  // Pre-upgrade hook to preserve data
  system func preupgrade() {
    fileEntries := Iter.toArray(files.entries());
  };

  // Post-upgrade hook to restore data
  system func postupgrade() {
    files := HashMap.fromIter<Text, File>(fileEntries.vals(), 0, Text.equal, Text.hash);
  };
}
