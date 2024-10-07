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

  // Function to upload a file
  public func uploadFile(name: Text, content_type: Text, data: Blob) : async Text {
    let file : File = {
      name = name;
      content_type = content_type;
      data = data;
    };
    files.put(name, file);
    Debug.print("File uploaded: " # name);
    "File uploaded successfully"
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
