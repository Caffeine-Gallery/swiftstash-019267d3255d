export const idlFactory = ({ IDL }) => {
  const FileInfo = IDL.Record({
    'content' : IDL.Vec(IDL.Nat8),
    'contentType' : IDL.Text,
    'name' : IDL.Text,
  });
  return IDL.Service({
    'deleteFile' : IDL.Func([IDL.Text], [], []),
    'getFileContent' : IDL.Func(
        [IDL.Text],
        [IDL.Opt(IDL.Vec(IDL.Nat8))],
        ['query'],
      ),
    'getFileInfo' : IDL.Func([IDL.Text], [IDL.Opt(FileInfo)], ['query']),
    'listFiles' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'uploadFile' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(IDL.Nat8)],
        [IDL.Text],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
