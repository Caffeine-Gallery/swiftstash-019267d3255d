export const idlFactory = ({ IDL }) => {
  const FileInfo = IDL.Record({
    'content' : IDL.Vec(IDL.Nat8),
    'contentType' : IDL.Text,
  });
  return IDL.Service({
    'deleteFile' : IDL.Func([IDL.Text], [], []),
    'getFileInfo' : IDL.Func(
        [IDL.Principal, IDL.Text],
        [IDL.Opt(FileInfo)],
        ['query'],
      ),
    'listFiles' : IDL.Func([IDL.Principal], [IDL.Vec(IDL.Text)], ['query']),
    'uploadFile' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Vec(IDL.Nat8)],
        [IDL.Text],
        [],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
