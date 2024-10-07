import Array "mo:base/Array";
import Error "mo:base/Error";
import Hash "mo:base/Hash";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";

import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Principal "mo:base/Principal";
import Text "mo:base/Text";

actor {
  type FileInfo = {
    contentType: Text;
    content: [Nat8];
  };

  type UserFiles = HashMap.HashMap<Text, FileInfo>;

  let userFiles = HashMap.HashMap<Principal, UserFiles>(0, Principal.equal, Principal.hash);

  public shared(msg) func uploadFile(name: Text, contentType: Text, content: [Nat8]) : async Text {
    if (content.size() <= 1) { return "Error: File must be larger than 1 byte" };
    
    let caller = msg.caller;
    switch (userFiles.get(caller)) {
      case (null) {
        let newUserFiles = HashMap.HashMap<Text, FileInfo>(0, Text.equal, Text.hash);
        newUserFiles.put(name, { contentType; content });
        userFiles.put(caller, newUserFiles);
      };
      case (?existingUserFiles) {
        existingUserFiles.put(name, { contentType; content });
      };
    };
    
    "Success: File uploaded"
  };

  public query func getFileInfo(caller: Principal, name: Text) : async ?FileInfo {
    switch (userFiles.get(caller)) {
      case (null) { null };
      case (?userFiles) { userFiles.get(name) };
    }
  };

  public query func listFiles(caller: Principal) : async [Text] {
    switch (userFiles.get(caller)) {
      case (null) { [] };
      case (?userFiles) { Iter.toArray(userFiles.keys()) };
    }
  };

  public shared(msg) func deleteFile(name: Text) : async () {
    switch (userFiles.get(msg.caller)) {
      case (null) { };
      case (?userFiles) { userFiles.delete(name) };
    };
  };
}
