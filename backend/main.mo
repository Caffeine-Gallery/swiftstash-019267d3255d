import Array "mo:base/Array";
import Error "mo:base/Error";
import Hash "mo:base/Hash";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";

import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Text "mo:base/Text";

actor {
  type FileInfo = {
    contentType: Text;
    content: [Nat8];
  };

  var files = HashMap.HashMap<Text, FileInfo>(0, Text.equal, Text.hash);

  public func uploadFile(name: Text, contentType: Text, content: [Nat8]) : async Text {
    if (content.size() <= 1) { return "Error: File must be larger than 1 byte" };
    files.put(name, { contentType; content });
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
}
