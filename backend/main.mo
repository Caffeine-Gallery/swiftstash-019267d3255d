import Error "mo:base/Error";
import Func "mo:base/Func";
import Hash "mo:base/Hash";
import Nat8 "mo:base/Nat8";

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
  public func uploadFile(name: Text, content_type: Text, data: [Nat8]) : async Text {
    if (data.size() == 0) {
      Debug.print("Error: Empty file data received");
      return "Error: Empty file data";
    };

    let file : File = {
      name = name;
      content_type = content_type;
      data = Blob.fromArray(data);
    };
    files.put(name, file);
    Debug.print("File uploaded: " # name # " (size: " # Nat.toText(data.size()) # " bytes)");
    "File uploaded successfully"
  };

  // Function to retrieve a file
  public query func getFile(name: Text) : async ?File {
    switch (files.get(name)) {
      case (null) { null };
      case (?file) {
        ?{
          name = file.name;
          content_type = file.content_type;
          data = file.data;
        }
      };
    }
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
