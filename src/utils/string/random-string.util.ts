export const randomString = (
  length: number,
  characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890()[]{}_-.,:;*',
) => {
  let str = '';
  for (let i = 0; i < length; i++) {
    str += characters[Math.floor(Math.random() * (characters.length + 1))];
  }
  return str;
};
