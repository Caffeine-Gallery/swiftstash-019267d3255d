import Error "mo:base/Error";
import Hash "mo:base/Hash";
import Nat8 "mo:base/Nat8";

import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Nat "mo:base/Nat";
import Text "mo:base/Text";

actor {
  type FileInfo = {
    name: Text;
    contentType: Text;
    content: [Nat8];
  };

  var files = HashMap.HashMap<Text, FileInfo>(0, Text.equal, Text.hash);

  public func uploadFile(name: Text, contentType: Text, content: [Nat8]) : async Text {
    if (content.size() == 0) {
      return "Error: Cannot upload empty file";
    };
    files.put(name, { name; contentType; content });
    "Success: File uploaded"
  };

  public query func getFileInfo(name: Text) : async ?FileInfo {
    files.get(name)
  };

  public query func listFiles() : async [Text] {
    Iter.toArray(files.keys())
  };

  public func deleteFile(name: Text) : async () {
    files.delete(name);
  };

  public query func getFileContent(name: Text) : async ?[Nat8] {
    switch (files.get(name)) {
      case (?file) { ?file.content };
      case (null) { null };
    }
  };

  system func preupgrade() {
    // Implement if needed
  };

  system func postupgrade() {
    // Implement if needed
  };
}
