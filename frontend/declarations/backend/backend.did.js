export const idlFactory = ({ IDL }) => {
  const FileInfo = IDL.Record({
    'contentType' : IDL.Text,
    'name' : IDL.Text,
    'size' : IDL.Nat64,
    'chunkCount' : IDL.Nat64,
  });
  return IDL.Service({
    'getFileChunk' : IDL.Func(
        [IDL.Text, IDL.Nat64],
        [IDL.Opt(IDL.Vec(IDL.Nat8))],
        ['query'],
      ),
    'getFileInfo' : IDL.Func([IDL.Text], [IDL.Opt(FileInfo)], ['query']),
    'listFiles' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'uploadFileChunk' : IDL.Func(
        [
          IDL.Text,
          IDL.Text,
          IDL.Nat64,
          IDL.Nat64,
          IDL.Nat64,
          IDL.Vec(IDL.Nat8),
        ],
        [],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
