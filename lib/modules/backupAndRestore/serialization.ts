import { mapValues } from "lodash-es";
type Serialized = string;
type Deserialized = Readonly<Record<string, unknown>>;
type Version0Schema = {
  SCHEMA_VERSION: void; // no schema version was included
  // json-encoded

  [key: string]: string;
};
type Version1Schema = {
  SCHEMA_VERSION: 1; // not stringified anymore

  [key: string]: unknown;
};
type Version2Schema = {
  SCHEMA_VERSION: 2;
  data: Readonly<Record<string, unknown>>; // not sharing a namespace anymore

};
export function serialize(settings: Deserialized): Serialized {
  const object: Version2Schema = {
    SCHEMA_VERSION: 2,
    data: settings
  };
  return JSON.stringify(object);
}
export function deserialize(string: Serialized): Deserialized {
  const object = JSON.parse(string);

  switch (object.SCHEMA_VERSION) {
    case 1:
      {
        const {
          SCHEMA_VERSION,
          ...settings
        } = (object as Version1Schema);
        return settings;
      }

    case 2:
      {
        const {
          data: settings
        } = (object as Version2Schema);
        return settings;
      }

    default:
      {
        const {
          SCHEMA_VERSION,
          ...encoded
        } = (object as Version0Schema);
        return mapValues(encoded, (v, k) => {
          try {
            return JSON.parse(v);
          } catch (e) {
            console.warn('Could not parse:', k, 'falling back to raw string.');
            return v;
          }
        });
      }
  }
}