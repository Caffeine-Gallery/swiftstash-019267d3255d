export const idlFactory = ({ IDL }) => {
  const File = IDL.Record({
    'data' : IDL.Vec(IDL.Nat8),
    'name' : IDL.Text,
    'content_type' : IDL.Text,
  });
  return IDL.Service({
    'getFile' : IDL.Func([IDL.Text], [IDL.Opt(File)], ['query']),
    'listFiles' : IDL.Func([], [IDL.Vec(IDL.Text)], ['query']),
    'uploadFile' : IDL.Func([IDL.Text, IDL.Text, IDL.Vec(IDL.Nat8)], [], []),
  });
};
export const init = ({ IDL }) => { return []; };
