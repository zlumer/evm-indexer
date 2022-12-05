export const removeDuplicates = (arr: string[]) => Object.keys(arr.reduce((acc, cur) => Object.assign(acc, { [cur]: 1 }), {}))
export const mapObj = <Key extends string, Value extends unknown, Result extends unknown>(obj: Record<Key, Value>, f: (k: Key, v: Value) => Result) =>
{
	const result = {} as Record<Key, Result>
	for (let k in obj)
		result[k] = f(k, obj[k])
	return result
}
