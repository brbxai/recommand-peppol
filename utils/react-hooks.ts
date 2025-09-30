import { useState } from "react";

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)!) : initialValue);

  const setValueWithLocalStorage = (value: T) => {
    setValue(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  return [value, setValueWithLocalStorage] as const;
}