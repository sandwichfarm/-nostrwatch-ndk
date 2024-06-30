type GenericObject = { [key: string]: any };

export const popProp = (obj: GenericObject, ...props: string[]) => {
  const result: GenericObject = {};
  for (const prop of props) {
    if (prop in obj) {
      result[prop] = obj[prop];
      delete obj[prop];
    }
  }
  return result;
}