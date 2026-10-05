import { createToolHandler, defineTool } from "@fastgpt-plugin/sdk-factory";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";

//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function joinValues(array, separator = "|") {
	return array.map((val) => stringifyPrimitive(val)).join(separator);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
var Cached = class {
	constructor(getter) {
		this._getter = getter;
		this._value = void 0;
	}
	get value() {
		const getter = this._getter;
		if (getter !== void 0) {
			this._value = getter();
			this._getter = void 0;
		}
		return this._value;
	}
};
function cached(getter) {
	return new Cached(getter);
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
	const ratio = val / step;
	const roundedRatio = Math.round(ratio);
	const tolerance = 4 * Number.EPSILON * Math.max(Math.abs(ratio), 1);
	if (Math.abs(ratio - roundedRatio) < tolerance) return 0;
	return ratio - roundedRatio;
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
/**
* Whichever object a def's `shape` currently answers from: the one the caller passed until the first read, the frozen copy after it.
*
* Its keys and descriptors read without invoking anything, which is what lets a discriminated union check its discriminator, and the cycle walk read a shape, without resolving a getter that references the schema being constructed. A def that answers `shape` from an accessor of its own has none.
*/
function rawShape(def) {
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	return desc?.get ? desc.get.raw : desc?.value;
}
function sourceShape(schema) {
	return rawShape(schema._zod.def) ?? schema._zod.def.shape;
}
function deferProp(target, key, getter) {
	Object.defineProperty(target, key, {
		get() {
			const value = getter();
			assignProp(this, key, value);
			return value;
		},
		enumerable: true,
		configurable: true
	});
}
function putProp(target, key, value) {
	if (key in target) assignProp(target, key, value);
	else target[key] = value;
}
/**
* Copies `keys` of `source`'s shape onto `target`, each value passed through `wrap`.
*
* A key the source has resolved is copied through now, so the derived shape states it outright and nothing has to resolve it to learn what it holds. A key the source still defers stays deferred, and reads back through the source's own `shape`, so it resolves once and both shapes get that one schema.
*/
function mirrorShape(target, source, keys, wrap) {
	const raw = sourceShape(source);
	for (const key of keys) {
		const desc = Object.getOwnPropertyDescriptor(raw, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => {
			const value = source._zod.def.shape[key];
			return wrap ? wrap(value, key) : value;
		});
		else putProp(target, key, wrap ? wrap(desc.value, key) : desc.value);
	}
}
function mirrorProps(target, source) {
	for (const key of Reflect.ownKeys(source)) {
		const desc = Object.getOwnPropertyDescriptor(source, key);
		if (!desc.enumerable) continue;
		if (desc.get) deferProp(target, key, () => source[key]);
		else putProp(target, key, desc.value);
	}
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) Object.assign(mergedDescriptors, Object.getOwnPropertyDescriptors(def));
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = /* @__PURE__ */ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
const propertyKeyTypes = /* @__PURE__ */ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function stringifyPrimitive(value) {
	if (typeof value === "bigint") return value.toString() + "n";
	if (typeof value === "string") return `"${value}"`;
	return `${value}`;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin !== void 0 && shape[k]._zod.optout === "optional";
	});
}
const NUMBER_FORMAT_RANGES = {
	safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
	int32: [-2147483648, 2147483647],
	uint32: [0, 4294967295],
	float32: [-34028234663852886e22, 34028234663852886e22],
	float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
const BIGINT_FORMAT_RANGES = {
	int64: [/* @__PURE__ */ BigInt("-9223372036854775808"), /* @__PURE__ */ BigInt("9223372036854775807")],
	uint64: [/* @__PURE__ */ BigInt(0), /* @__PURE__ */ BigInt("18446744073709551615")]
};
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	const newShape = {};
	mirrorShape(newShape, schema, maskedKeys(schema, mask));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function maskedKeys(schema, mask) {
	const raw = sourceShape(schema);
	const keys = [];
	for (const key of Reflect.ownKeys(mask)) {
		if (!Object.getOwnPropertyDescriptor(raw, key)?.enumerable) throw new Error(`Unrecognized key: "${String(key)}"`);
		if (mask[key]) keys.push(key);
	}
	return keys;
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	const omitted = new Set(maskedKeys(schema, mask));
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)).filter((key) => !omitted.has(key)));
	return clone(schema, mergeDefs(currDef, {
		shape: newShape,
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = sourceShape(schema);
		for (const key of Reflect.ownKeys(shape)) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function extended(schema, shape) {
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)));
	mirrorProps(newShape, shape);
	return newShape;
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { shape: extended(schema, shape) }));
}
function merge(a, b) {
	if (!b?._zod?.def) throw new Error("Invalid input to merge: expected an object schema. To merge a plain shape, use `.extend()`.");
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	const newShape = {};
	mirrorShape(newShape, a, Reflect.ownKeys(sourceShape(a)));
	mirrorShape(newShape, b, Reflect.ownKeys(sourceShape(b)));
	return clone(a, mergeDefs(a._zod.def, {
		shape: newShape,
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask, name = "partial") {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(`.${name}() cannot be used on object schemas containing refinements`);
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), Class && ((value, key) => selected && !selected.has(key) ? value : new Class({
		type: "optional",
		innerType: value
	})));
	return clone(schema, mergeDefs(schema._zod.def, {
		shape: newShape,
		checks: []
	}));
}
function required(Class, schema, mask) {
	const selected = mask ? new Set(maskedKeys(schema, mask)) : void 0;
	const newShape = {};
	mirrorShape(newShape, schema, Reflect.ownKeys(sourceShape(schema)), (value, key) => selected && !selected.has(key) ? value : new Class({
		type: "nonoptional",
		innerType: value
	}));
	return clone(schema, mergeDefs(schema._zod.def, { shape: newShape }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
function attachSchema(issues, start, inst) {
	var _a;
	for (let i = start; i < issues.length; i++) (_a = issues[i]).schema ?? (_a.schema = inst);
}
function finalizeIssue(iss, ctx, config) {
	var _a;
	const traits = iss.inst?._zod?.traits;
	if (traits?.has("$ZodType")) if (traits.has("$ZodCheck")) (_a = iss).schema ?? (_a.schema = iss.inst);
	else iss.schema = iss.inst;
	const schemaError = iss.schema !== iss.inst ? iss.schema?._zod.def?.error : void 0;
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(schemaError?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const full = {};
	for (const k of Object.keys(iss)) {
		if (k === "inst" || k === "schema" || k === "continue" || k === "input" || k === "__proto__") continue;
		full[k] = iss[k];
	}
	full.path ?? (full.path = []);
	full.message = message;
	if (ctx?.reportInput) full.input = iss.input;
	return full;
}
const highSurrogate = /[\uD800-\uDBFF]/;
function codePointLength(str) {
	const units = str.length;
	if (!highSurrogate.test(str)) return units;
	let count = units;
	for (let i = 0; i < units - 1; i++) if ((str.charCodeAt(i) & 64512) === 55296 && (str.charCodeAt(i + 1) & 64512) === 56320) {
		count--;
		i++;
	}
	return count;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function parsedType(data) {
	const t = typeof data;
	switch (t) {
		case "number": return Number.isNaN(data) ? "nan" : "number";
		case "object": {
			if (data === null) return "null";
			if (Array.isArray(data)) return "array";
			const obj = data;
			if (obj && Object.getPrototypeOf(obj) !== Object.prototype && "constructor" in obj && obj.constructor) return obj.constructor.name;
		}
	}
	return t;
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
/**
* Installs a trait's members on its prototype. Each value builds that member for the instance on first read; the built value shadows the accessor as an own property, so a detached `const { parse } = schema` keeps working.
*
* Call this from a `proto` initializer, which runs once per prototype — never per instance.
*/
function members(proto, table) {
	for (const key in table) {
		const desc = Object.getOwnPropertyDescriptor(table, key);
		if (desc.get) Object.defineProperty(proto, key, {
			...desc,
			enumerable: false
		});
		else defineBound(proto, key, desc.value);
	}
}
/** Shadows a prototype member with an own value, so a getter that builds from the instance runs once. */
function own(inst, key, value, enumerable = true) {
	Object.defineProperty(inst, key, {
		configurable: true,
		writable: true,
		enumerable,
		value
	});
	return value;
}
/** Like {@link own}, for a member that was never an own data property and has to stay out of `Object.keys`. */
function hide(inst, key, value) {
	return own(inst, key, value, false);
}
/** Adds members a table derives from the instance: each builds on first read and shadows as own data, and assignment shadows the same way, as when these were own properties. */
function derived(computes, table) {
	for (const key in computes) {
		const compute = computes[key];
		Object.defineProperty(table, key, {
			configurable: true,
			enumerable: true,
			get() {
				return own(this, key, compute(this));
			},
			set(value) {
				own(this, key, value);
			}
		});
	}
	return table;
}
function defineBound(proto, key, fn) {
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			return this == null ? fn : own(this, key, fn.bind(this));
		},
		set(value) {
			own(this, key, value);
		}
	});
}
/** Returns the prototype to install on, or `undefined` if this group is already installed on it. */
function claim(inst, sentinel) {
	const proto = Object.getPrototypeOf(inst);
	return sentinel in proto ? void 0 : proto;
}
let installing;
let broke = false;
const breaker = {
	configurable: true,
	get() {
		broke = true;
	}
};
/**
* Installs a lazily-derived internal on the `_zod` prototype of `inst`'s
* constructor, computed from the internals object itself and cached there on
* first read. One accessor per constructor rather than one per instance.
*/
function defineLazyInternal(inst, key, compute) {
	const proto = Object.getPrototypeOf(inst._zod);
	if (key in proto && installing !== inst._zod) {
		installing = void 0;
		return;
	}
	installing = inst._zod;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			Object.defineProperty(this, key, breaker);
			const outer = broke;
			broke = false;
			try {
				const value = compute(this);
				if (broke) delete this[key];
				else Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					value
				});
				broke = broke || outer;
				return value;
			} catch (err) {
				delete this[key];
				broke = broke || outer;
				throw err;
			}
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				value
			});
		}
	});
}
/**
* Installs `key` on `inst`'s prototype, computed by `make` on first read and cached there as an own
* data property. One accessor per constructor rather than one per instance, because an own accessor
* puts every instance after the first into v8 dictionary mode. The key doubles as the sentinel.
*/
function installLazyProp(inst, key, make, enumerable) {
	const proto = claim(inst, key);
	if (!proto) return;
	Object.defineProperty(proto, key, {
		configurable: true,
		get() {
			const desc = {
				configurable: true,
				writable: true,
				enumerable,
				value: void 0
			};
			Object.defineProperty(this, key, desc);
			desc.value = make(this);
			Object.defineProperty(this, key, desc);
			return desc.value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				configurable: true,
				writable: true,
				enumerable,
				value
			});
		}
	});
}
/** Marks the thunk `_catch` synthesises for a constant catch value. `Function.length` cannot tell that thunk from a user callback — rest and defaulted parameters both report arity 0 — and a user callback reads `ctx.error`, whose issues only finalize correctly against the caller's per-parse error map. Provenance can say what arity cannot. A plain string key rather than `Symbol.for`, whose call at module scope no bundler can prove pure — the same shape that anchored `urlCanParse` into every build. */
const CONSTANT_CATCH = "~constantCatch";
/** Wraps a constant catch value in a thunk tagged with {@link CONSTANT_CATCH}. */
function constantCatch(value) {
	const fn = () => value;
	fn[CONSTANT_CATCH] = true;
	return fn;
}

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/core.js
var _a$1;
const _zodDesc = {
	value: void 0,
	enumerable: false
};
let _E = "captureStackTrace" in Error ? Error : null;
function newError(Definition) {
	const E = _E;
	if (E) {
		const saved = E.stackTraceLimit;
		if (typeof saved === "number") {
			try {
				E.stackTraceLimit = 0;
			} catch {
				_E = null;
				return new Definition();
			}
			try {
				return new Definition();
			} finally {
				E.stackTraceLimit = saved;
			}
		}
	}
	return new Definition();
}
function $constructor(name, initializer, proto, params) {
	const zodProto = {};
	function Internals(def) {
		this.def = def;
		this.constr = _;
		this.traits = /* @__PURE__ */ new Set();
	}
	Internals.prototype = zodProto;
	const protoMembers = proto;
	const initialized = protoMembers && /* @__PURE__ */ new WeakSet();
	function init(inst, def) {
		if (!inst._zod) {
			_zodDesc.value = new Internals(def);
			try {
				Object.defineProperty(inst, "_zod", _zodDesc);
			} finally {
				_zodDesc.value = void 0;
			}
		} else if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		if (initialized) {
			const own = Object.getPrototypeOf(inst);
			const ctorProto = inst._zod.constr.prototype;
			let up = own;
			while (up && up !== ctorProto) up = Object.getPrototypeOf(up);
			const target = up ?? own;
			if (!initialized.has(target)) {
				initialized.add(target);
				members(target, protoMembers);
			}
		}
		const proto = _.prototype;
		for (const k in proto) {
			if (!Object.prototype.hasOwnProperty.call(proto, k)) continue;
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		const inst = params?.Parent ? newError(Definition) : this;
		init(inst, def);
		const deferred = inst._zod.deferred;
		if (deferred) {
			for (const fn of deferred) fn();
			inst._zod.deferred = void 0;
		}
		const pp = globalThis.__zod_globalConfig?.postProcessor;
		if (pp) pp(inst);
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
const globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/errors.js
function _getMessage() {
	const internals = this._zod;
	internals.message ?? (internals.message = JSON.stringify(internals.def, jsonStringifyReplacer, 2));
	return internals.message;
}
function _setMessage(value) {
	this._zod.message = value;
}
const _messageDesc = {
	get: _getMessage,
	set: _setMessage,
	enumerable: true,
	configurable: true
};
const _issuesDesc = {
	value: void 0,
	enumerable: false
};
const _installedToString = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
const initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	_issuesDesc.value = def;
	Object.defineProperty(inst, "issues", _issuesDesc);
	_issuesDesc.value = void 0;
	Object.defineProperty(inst, "message", _messageDesc);
	const proto = Object.getPrototypeOf(inst);
	if (!_installedToString.has(proto)) {
		_installedToString.add(proto);
		Object.defineProperty(proto, "toString", {
			configurable: true,
			enumerable: false,
			get() {
				const value = () => this.message;
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
				return value;
			},
			set(value) {
				Object.defineProperty(this, "toString", {
					value,
					configurable: true,
					writable: true
				});
			}
		});
	}
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, void 0, { Parent: Error });
/** Get-or-create `obj[key]` as an own data property. A path segment naming an inherited member
* ("toString", "constructor") would otherwise read through to the prototype, and assigning
* "__proto__" would hit the setter instead of creating a key. */
function node(obj, key, make) {
	if (!Object.prototype.hasOwnProperty.call(obj, key)) if (key === "__proto__") Object.defineProperty(obj, key, {
		value: make(),
		writable: true,
		enumerable: true,
		configurable: true
	});
	else obj[key] = make();
	return obj[key];
}
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) node(fieldErrors, sub.path[0], () => []).push(mapper(sub));
	else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					const terminal = i === fullpath.length - 1;
					if (el === "_errors") {
						if (terminal) curr._errors.push(mapper(issue));
						i++;
						continue;
					}
					if (!Object.prototype.hasOwnProperty.call(curr, el)) Object.defineProperty(curr, el, {
						value: { _errors: [] },
						enumerable: true,
						writable: true,
						configurable: true
					});
					const node = curr[el];
					if (terminal) node._errors.push(mapper(issue));
					curr = node;
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/parse.js
function finalizeParams(callee, params) {
	return {
		callee: params?.callee ?? callee,
		Err: params?.Err
	};
}
const _parse = (_Err) => {
	const fn = (schema, value, _ctx, _params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: false
		} : { async: false };
		const result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) throw new $ZodAsyncError();
		if (result.issues.length) {
			const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, _params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
const _parseAsync = (_Err) => {
	const fn = async (schema, value, _ctx, params) => {
		const ctx = _ctx ? {
			..._ctx,
			async: true
		} : { async: true };
		let result = schema._zod.run({
			value,
			issues: []
		}, ctx);
		if (result instanceof Promise) result = await result;
		if (result.issues.length) {
			const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
			captureStackTrace(e, params?.callee ?? fn);
			throw e;
		}
		return result.value;
	};
	return fn;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
function failure(Err, issues, ctx) {
	let error;
	return {
		success: false,
		get error() {
			if (!error) {
				error = new Err(issues.map((iss) => finalizeIssue(iss, ctx, config())));
				issues = void 0;
				ctx = void 0;
			}
			return error;
		},
		set error(e) {
			error = e;
			issues = void 0;
			ctx = void 0;
		}
	};
}
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? failure(_Err, result.issues, ctx) : {
		success: true,
		data: result.value
	};
};
const COMPILE_INVALID = /* @__PURE__ */ Symbol.for("zod.compile.invalid");
const COMPILE_FALLBACK = /* @__PURE__ */ Symbol.for("zod.compile.fallback");
const validate = ((schema, value, _ctx) => {
	const validator = schema._zod.bag.validator;
	if (validator !== void 0) {
		if (validator(value) !== COMPILE_INVALID) return true;
		if (validator.definite === true && _ctx === void 0) return false;
	}
	return validateFallback(schema, value, _ctx);
});
function validateFallback(schema, value, _ctx) {
	const ctx = _ctx ? {
		..._ctx,
		async: false,
		abortEarly: true
	} : {
		async: false,
		abortEarly: true
	};
	const fallbackRun = schema._zod.bag.fallbackRun;
	let result;
	if (fallbackRun) {
		ctx[COMPILE_FALLBACK] = true;
		result = fallbackRun({
			value,
			issues: []
		}, ctx);
	} else result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length === 0;
}
const validateAsync$1 = async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true,
		abortEarly: true
	} : {
		async: true,
		abortEarly: true
	};
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length === 0;
};
const _encode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		return parse(schema, value, _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" }, finalizeParams(fn, _params));
	};
	return fn;
};
const _decode = (_Err) => {
	const parse = _parse(_Err);
	const fn = (schema, value, _ctx, _params) => {
		return parse(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
const _encodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		return await parseAsync(schema, value, _ctx ? {
			..._ctx,
			direction: "backward"
		} : { direction: "backward" }, finalizeParams(fn, _params));
	};
	return fn;
};
const _decodeAsync = (_Err) => {
	const parseAsync = _parseAsync(_Err);
	const fn = async (schema, value, _ctx, _params) => {
		return await parseAsync(schema, value, _ctx, finalizeParams(fn, _params));
	};
	return fn;
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const cuid = /^[cC][0-9a-z]{6,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
function nanoidOfLength(length) {
	return new RegExp(`^[a-zA-Z0-9_-]{${length}}$`);
}
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
const duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
const uuid = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
const email = /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^(?=[\\s\\S]*[\\p{Extended_Pictographic}\\p{Regional_Indicator}\\u20E3])[\\p{Extended_Pictographic}\\p{Emoji_Component}]+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^(?:[A-Za-z0-9_-]{4})*(?:[A-Za-z0-9_-]{2,3})?$/;
const httpProtocol = /^https?$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
/** Anchors a pattern source. The interpolation lives here rather than at the call site because
* esbuild will not drop a `@__PURE__` call whose own argument interpolates a variable, but it
* will drop `anchor(dateSource)`. Keeping it inline pinned `date` into every bundle. */
function anchor(source) {
	return new RegExp(`^${source}$`);
}
const date = /* @__PURE__ */ anchor(dateSource);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : args.seconds ? `${hhmm}:[0-5]\\d(?:\\.\\d+)?` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
	const opts = ["Z"];
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const qualified = `${timeSource({
		precision: args.precision,
		seconds: true
	})}(?:${opts.join("|")})`;
	const timeRegex = args.local ? `${qualified}|${timeSource({ precision: args.precision })}` : qualified;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const anyString = /^[\s\S]{0,}$/;
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/checks.js
const $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
/** Default `when` for length-based checks: run only on non-nullish values with a `length`. */
const _whenHasLength = (payload) => {
	const val = payload.value;
	return !nullish(val) && val.length !== void 0;
};
const numericOriginMap = {
	number: "number",
	bigint: "bigint",
	object: "date"
};
const $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value <= def.value : payload.value < def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_big",
			maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
	$ZodCheck.init(inst, def);
	const origin = numericOriginMap[typeof def.value];
	inst._zod.check = (payload) => {
		if (def.inclusive ? payload.value >= def.value : payload.value > def.value) return;
		payload.issues.push({
			origin: numericOriginMap[typeof payload.value] ?? origin,
			code: "too_small",
			minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
			input: payload.value,
			inclusive: def.inclusive,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		if (typeof payload.value !== typeof def.value) throw new Error("Cannot mix number and bigint in multiple_of check.");
		if (typeof payload.value === "bigint" ? def.value !== BigInt(0) && payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0) return;
		payload.issues.push({
			origin: typeof payload.value,
			code: "not_multiple_of",
			divisor: def.value,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
	$ZodCheck.init(inst, def);
	def.format = def.format || "float64";
	const isInt = def.format?.includes("int");
	const origin = isInt ? "int" : "number";
	const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (isInt) {
			if (!Number.isInteger(input)) {
				payload.issues.push({
					expected: origin,
					format: def.format,
					code: "invalid_type",
					continue: false,
					input,
					inst
				});
				return;
			}
			if (!Number.isSafeInteger(input)) {
				if (input > 0) payload.issues.push({
					input,
					code: "too_big",
					maximum: Number.MAX_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				else payload.issues.push({
					input,
					code: "too_small",
					minimum: Number.MIN_SAFE_INTEGER,
					note: "Integers must be within the safe integer range.",
					inst,
					origin,
					inclusive: true,
					continue: !def.abort
				});
				return;
			}
		}
		if (input < minimum) payload.issues.push({
			origin: "number",
			input,
			code: "too_small",
			minimum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
		if (input > maximum) payload.issues.push({
			origin: "number",
			input,
			code: "too_big",
			maximum,
			inclusive: true,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units > def.maximum ? codePointLength(input) : units) <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		if ((typeof input === "string" && units >= def.minimum && units < def.minimum * 2 ? codePointLength(input) : units) >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = _whenHasLength);
	inst._zod.check = (payload) => {
		const input = payload.value;
		const units = input.length;
		const length = typeof input === "string" && units >= def.length && units <= def.length * 2 ? codePointLength(input) : units;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
const $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex(def.includes);
	def.pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position},}${escapedRegex}` : escapedRegex);
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = [], closed = {}) {
		this.content = [];
		this.indent = 0;
		this.args = args;
		this.closed = closed;
	}
	indented(fn) {
		this.indent += 1;
		try {
			fn(this);
		} finally {
			this.indent -= 1;
		}
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const content = this?.content ?? [``];
		return new F(...Object.keys(this.closed), `return function (${this.args.join(", ")}) {\n${content.join("\n")}\n};`)(...Object.values(this.closed));
	}
};

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/versions.js
const version = {
	major: 4,
	minor: 6,
	patch: 5
};

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/schemas.js
const $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const defChecks = inst._zod.def.checks;
	const checks = inst._zod.traits.has("$ZodCheck") ? [inst, ...defChecks ?? []] : defChecks?.length ? [...defChecks] : [];
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			if (payload.memo) return payload;
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					attachSchema(payload.issues, currLen, inst);
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
}, {
	get "~standard"() {
		return hide(this, "~standard", standardProps(this));
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	}
});
/** The Standard Schema surface for `inst`. Shared so wrappers can extend it without forcing it. */
const toStandardResult = (r, ctx) => r.issues.length ? { issues: r.issues.map((iss) => finalizeIssue(iss, ctx, config())) } : { value: r.value };
async function validateAsync(inst, value) {
	const ctx = { async: true };
	return toStandardResult(await inst._zod.run({
		value,
		issues: []
	}, ctx), ctx);
}
function standardProps(inst) {
	return {
		validate: (value) => {
			const ctx = { async: false };
			try {
				const r = inst._zod.run({
					value,
					issues: []
				}, ctx);
				if (!(r instanceof Promise)) return toStandardResult(r, ctx);
			} catch (_) {}
			return validateAsync(inst, value);
		},
		vendor: "zod",
		version: 1
	};
}
const $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = def.pattern ?? anyString;
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
const $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
const $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
const $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid(v));
	} else def.pattern ?? (def.pattern = uuid());
	$ZodStringFormat.init(inst, def);
});
const $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
/** The `://` guard rejected the input before the URL constructor saw it. */
const URL_BAD_FORMAT = 1;
/** The URL parser rejected the input. */
const URL_UNPARSEABLE = 2;
function canParseURL(input) {
	try {
		if (typeof URL !== "undefined" && typeof URL.canParse === "function") return URL.canParse(input);
		new URL(input);
		return true;
	} catch {
		return false;
	}
}
function validateURL(trimmed, def) {
	if (!("normalize" in def) && !("hostname" in def) && !("protocol" in def)) return canParseURL(trimmed) || 2;
	return parseURLObject(trimmed, def);
}
/** Parses a URL while preserving the non-normalizing HTTP guard. */
function parseURLObject(trimmed, def) {
	if (!def.normalize && def.protocol?.source === httpProtocol.source && !/^https?:\/\//i.test(trimmed)) return 1;
	try {
		if (typeof URL !== "undefined") {
			const URLStatic = URL;
			if (typeof URLStatic.parse === "function") return URLStatic.parse(trimmed) ?? 2;
		}
		return new URL(trimmed);
	} catch {
		return 2;
	}
}
const asciiTabOrNewline = /[\t\n\r]/g;
/** The URL parser deletes every ASCII tab, LF and CR from its input before it parses, so `new URL("https://exa\nmple.com")` reports on `example.com`. Applying the same deletion to the returned value closes the half of that divergence which can move the host; the parser's other rewrite, stripping C0 controls at the edges, cannot. */
function stripTabAndNewline(value) {
	return value.replace(asciiTabOrNewline, "");
}
function urlHostnameOk(url, hostname) {
	hostname.lastIndex = 0;
	return hostname.test(url.hostname);
}
function urlProtocolOk(url, protocol) {
	protocol.lastIndex = 0;
	return protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol);
}
const $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			const url = validateURL(trimmed, def);
			if (url === 1) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid URL format",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === 2) {
				payload.issues.push({
					code: "invalid_format",
					format: "url",
					input: payload.value,
					inst,
					continue: !def.abort
				});
				return;
			}
			if (url === true) {
				payload.value = stripTabAndNewline(trimmed);
				return;
			}
			if (def.hostname && !urlHostnameOk(url, def.hostname)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid hostname",
				pattern: def.hostname.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			if (def.protocol && !urlProtocolOk(url, def.protocol)) payload.issues.push({
				code: "invalid_format",
				format: "url",
				note: "Invalid protocol",
				pattern: def.protocol.source,
				input: payload.value,
				inst,
				continue: !def.abort
			});
			payload.value = def.normalize ? url.href : stripTabAndNewline(trimmed);
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
const $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
	if (def.length !== void 0 && (!Number.isInteger(def.length) || def.length < 1)) throw new Error(`Invalid nanoid length: ${def.length}`);
	def.pattern ?? (def.pattern = def.length === void 0 ? nanoid : nanoidOfLength(def.length));
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
const $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
const $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date);
	$ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration);
	$ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
});
/** An IPv6 address is written with hex digits, colons and dots, and nothing else. The guard is what makes the check below an IPv6 check: `new URL("http://[...]")` parses an authority, not an address, so `@` and `\` re-delimit it and `"::@1\\"` validates against the host `0.0.0.1`. The URL parser also deletes ASCII tab, LF and CR rather than failing, which is how `"::1\n"` validated as `::1`. */
const ipv6Alphabet = /^[0-9a-fA-F:.]+$/;
function isValidIPv6(value) {
	if (!ipv6Alphabet.test(value)) return false;
	return canParseURL(`http://[${value}]`);
}
const $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidIPv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "ipv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
function isValidCIDRv6(value) {
	const parts = value.split("/");
	if (parts.length !== 2) return false;
	const [address, prefix] = parts;
	if (!prefix) return false;
	const prefixNum = Number(prefix);
	if (`${prefixNum}` !== prefix) return false;
	if (prefixNum < 0 || prefixNum > 128) return false;
	return isValidIPv6(address);
}
const $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (!isValidCIDRv6(payload.value)) payload.issues.push({
			code: "invalid_format",
			format: "cidrv6",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
const base64Charset = /^[0-9a-zA-Z+/]*={0,2}$/;
const $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64Charset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const base64urlCharset = /^[A-Za-z0-9_-]*$/;
function isValidBase64URL(data) {
	if (!base64urlCharset.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
const $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64urlCharset);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
const $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = number$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Number(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) return payload;
		const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? String(input) : void 0 : void 0;
		payload.issues.push({
			expected: "number",
			code: "invalid_type",
			input,
			inst,
			...received ? { received } : {}
		});
		return payload;
	};
});
const $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
	$ZodCheckNumberFormat.init(inst, def);
	$ZodNumber.init(inst, def);
});
const $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
const $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
const $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, Array(input.length), ctx) : Array(input.length);
		const proms = [];
		const abortEarly = ctx?.abortEarly;
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else {
				handleArrayResult(result, payload, i);
				if (abortEarly && result.issues.length !== 0 && aborted(result)) break;
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
function handlePropertyResult(result, final, key, input, optin, optout) {
	const isPresent = key in input;
	const isOptionalOut = optout === "optional";
	if (!isPresent && isOptionalOut && optin === "optional") return;
	if (result.issues.length) {
		if (optin !== void 0 && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && optin === void 0) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent || optin === "defaulted" && !isOptionalOut) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
const NO_SYMBOL_KEYS = [];
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	const ownSymbols = Object.getOwnPropertySymbols(def.shape);
	const symbolKeys = ownSymbols.length ? ownSymbols : NO_SYMBOL_KEYS;
	const allKeys = symbolKeys.length ? [...keys, ...symbolKeys] : keys;
	for (const k of allKeys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${String(k)}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		allKeys,
		symbolKeys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst, abortEarly) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const optin = _catchall.optin;
	const optout = _catchall.optout;
	let seen = 0;
	for (const key in input) {
		if (abortEarly && payload.issues.length !== seen) {
			if (aborted(payload, seen)) break;
			seen = payload.issues.length;
		}
		if (keySet.has(key)) continue;
		if (key === "__proto__") {
			if (t === "never") unrecognized.push(key);
			continue;
		}
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
		else handlePropertyResult(r, payload, key, input, optin, optout);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst,
		continue: true
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
const $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	const desc = Object.getOwnPropertyDescriptor(def, "shape");
	const sh = desc?.get ? desc.get.raw : def.shape ?? {};
	if (sh) {
		const get = () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			get.raw = newSh;
			return newSh;
		};
		get.raw = sh;
		Object.defineProperty(def, "shape", { get });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazyInternal(inst, "propValues", (zod) => {
		const shape = zod.def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				if (!Object.prototype.hasOwnProperty.call(propValues, key)) assignProp(propValues, key, /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
				if (field.optin !== void 0) propValues[key].add(void 0);
			}
		}
		return propValues;
	});
	const isObject$1 = isObject;
	const catchall = def.catchall;
	let value;
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
		const proms = [];
		const shape = value.shape;
		const abortEarly = ctx?.abortEarly;
		let seen = payload.issues.length;
		for (const key of value.allKeys) {
			if (abortEarly && payload.issues.length !== seen) {
				if (aborted(payload, seen)) break;
				seen = payload.issues.length;
			}
			if (key === "__proto__") continue;
			const el = shape[key];
			const optin = el._zod.optin;
			const optout = el._zod.optout;
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, optin, optout)));
			else handlePropertyResult(r, payload, key, input, optin, optout);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst, abortEarly === true);
	};
});
const $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const memo = globalConfig.memoizer;
	const generateFastpass = (shape) => {
		const normalized = _normalized.value;
		const syms = normalized.symbolKeys;
		const doc = new Doc(["payload", "ctx"], {
			shape,
			inst,
			memo,
			syms
		});
		const parseStr = (k) => `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		const prefixStr = (id, k) => `
          let ${id}_ab = false;
          for (let i = 0; i < ${id}.issues.length; i++) {
            const iss = ${id}.issues[i];
            iss.path = iss.path ? [${k}, ...iss.path] : [${k}];
            payload.issues.push(iss);
            if (iss.continue !== true) ${id}_ab = true;
          }
          if (${id}_ab && ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }`;
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.allKeys) ids[key] = `key_${counter++}`;
		doc.write(memo ? `const newResult = memo.alloc(inst, payload, {}, ctx);` : `const newResult = {};`);
		for (const key of normalized.allKeys) {
			if (key === "__proto__") continue;
			const id = ids[key];
			const k = typeof key === "symbol" ? `syms[${syms.indexOf(key)}]` : esc(key);
			const isPresent = `${k} in input`;
			const schema = shape[key];
			const optin = schema?._zod?.optin;
			const isOptionalIn = optin !== void 0;
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(k)};`);
			if (isOptionalIn && isOptionalOut) {
				const assign = optin === "optional" ? `${id}_present` : `${id}.value !== undefined || ${id}_present`;
				doc.write(`
        const ${id}_present = ${isPresent};
        if (!${id}.issues.length || ${id}_present) {
          if (${id}.issues.length) {${prefixStr(id, k)}
          }

          if (${assign}) {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			} else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${isPresent};
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
          if (ctx && ctx.abortEarly) {
            payload.value = newResult;
            return payload;
          }
        }

        if (${id}_present) {
          newResult[${k}] = ${id}.value;
        }

      `);
			else {
				doc.write(`
        if (${id}.issues.length) {${prefixStr(id, k)}
        }
      `);
				if (optin === "defaulted") doc.write(`newResult[${k}] = ${id}.value;`);
				else doc.write(`
        if (${id}.value !== undefined || ${isPresent}) {
          newResult[${k}] = ${id}.value;
        }
      `);
			}
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		return doc.compile();
	};
	let fastpass;
	const isObject$2 = isObject;
	const jit = !globalConfig.jitless;
	const allowsEval$1 = allowsEval;
	const fastEnabled = jit && allowsEval$1.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst, ctx?.abortEarly === true);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
const $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.options.some((o) => o._zod.optin === "defaulted") ? "defaulted" : zod.def.options.some((o) => o._zod.optin !== void 0) ? "optional" : void 0);
	defineLazyInternal(inst, "optout", (zod) => zod.def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazyInternal(inst, "values", (zod) => {
		if (zod.def.options.every((o) => o._zod.values)) return new Set(zod.def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		if (zod.def.options.every((o) => o._zod.pattern)) {
			const patterns = zod.def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
const $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		if (Object.prototype.hasOwnProperty.call(newObj, "__proto__")) delete newObj.__proto__;
		for (const key of sharedKeys) {
			if (key === "__proto__") continue;
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	const keyIssues = /* @__PURE__ */ new Map();
	const collect = (iss, side) => {
		let keys;
		if (iss.code === "unrecognized_keys" && !iss.path?.length) {
			unrecIssue ?? (unrecIssue = iss);
			keys = iss.keys;
		} else if (iss.code === "invalid_key" && iss.origin === "record" && iss.path?.length === 1) {
			const k = String(iss.path[0]);
			if (!keyIssues.has(k)) keyIssues.set(k, iss);
			keys = [k];
		} else return false;
		for (const k of keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k)[side] = true;
		}
		return true;
	};
	for (const iss of left.issues) if (!collect(iss, "l")) result.issues.push(iss);
	for (const iss of right.issues) if (!collect(iss, "r")) result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length) {
		const aggregated = unrecIssue ? bothKeys.filter((k) => unrecIssue.keys.includes(k)) : [];
		if (aggregated.length) result.issues.push({
			...unrecIssue,
			keys: aggregated
		});
		for (const k of bothKeys) if (!aggregated.includes(k) && keyIssues.has(k)) result.issues.push(keyIssues.get(k));
	}
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) {
		if (aborted(result)) return result;
		throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	}
	result.value = merged.data;
	return result;
}
const $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
	$ZodType.init(inst, def);
	const memo = globalConfig.memoizer;
	memo?.attach(inst);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isPlainObject(input)) {
			payload.issues.push({
				expected: "record",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		const proms = [];
		const values = def.keyType._zod.values;
		if (values && !def.partial) {
			payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
			const recordKeys = /* @__PURE__ */ new Set();
			for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
				recordKeys.add(typeof key === "number" ? key.toString() : key);
				if (key === "__proto__") continue;
				const keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (keyResult.issues.length) {
					payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				if (outKey === "__proto__") continue;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			let unrecognized;
			for (const key in input) if (!recordKeys.has(key)) if (def.mode === "loose") {
				if (key === "__proto__") continue;
				payload.value[key] = input[key];
			} else {
				unrecognized = unrecognized ?? [];
				unrecognized.push(key);
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized,
				continue: true
			});
		} else {
			payload.value = memo ? memo.alloc(inst, payload, {}, ctx) : {};
			let unrecognized;
			for (const key of Reflect.ownKeys(input)) {
				if (key === "__proto__") continue;
				if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
				let keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (typeof key === "string" && number$1.test(key) && keyResult.issues.length) {
					const retryResult = def.keyType._zod.run({
						value: Number(key),
						issues: []
					}, ctx);
					if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (retryResult.issues.length === 0) keyResult = retryResult;
				}
				if (keyResult.issues.length) {
					if (def.mode === "loose") payload.value[key] = input[key];
					else if (values) {
						unrecognized = unrecognized ?? [];
						unrecognized.push(key);
					} else payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				if (outKey === "__proto__") continue;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized,
				continue: true
			});
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
const $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	defineLazyInternal(inst, "pattern", (zod) => {
		const patternValues = getEnumValues(zod.def.entries).filter((k) => propertyKeyTypes.has(typeof k));
		return new RegExp(patternValues.length ? `^(${patternValues.map((o) => escapeRegex(o.toString())).join("|")})$` : "^[^\\s\\S]$");
	});
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
const $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	globalConfig.memoizer?.guard(inst);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		return payload;
	};
});
function handleOptionalResult(payload, result) {
	payload.value = result.issues.length ? void 0 : result.value;
	return payload;
}
const $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	inst._zod.optout = "optional";
	defineLazyInternal(inst, "values", (zod) => {
		const values = zod.def.innerType._zod.values;
		return values ? new Set([...values, void 0]) : void 0;
	});
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === void 0) {
			if (def.innerType._zod.optin !== "defaulted") return payload;
			const result = def.innerType._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) return result.then((result) => handleOptionalResult(payload, result));
			return handleOptionalResult(payload, result);
		}
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "pattern", (zod) => zod.def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "pattern", (zod) => {
		const pattern = zod.def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazyInternal(inst, "values", (zod) => {
		return zod.def.innerType._zod.values ? new Set([...zod.def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
const $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "defaulted";
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => {
		const v = zod.def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
function handleCatchResult(payload, result, def, ctx) {
	if (!result.issues.length) {
		payload.value = result.value;
		if (result.memo) payload.memo = true;
		return payload;
	}
	payload.value = def.catchValue({
		...result,
		value: payload.value,
		error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
		input: payload.value
	});
	return payload;
}
const $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType._zod.optin === "defaulted" ? "defaulted" : "optional");
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType._zod.optout);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run({
			value: payload.value,
			issues: []
		}, ctx);
		if (result instanceof Promise) return result.then((result) => handleCatchResult(payload, result, def, ctx));
		return handleCatchResult(payload, result, def, ctx);
	};
});
const $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "values", (zod) => zod.def.in._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.in._zod.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.out._zod.optout);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.some((iss) => iss.code !== "unrecognized_keys")) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues
	}, ctx);
}
const $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazyInternal(inst, "propValues", (zod) => zod.def.innerType._zod.propValues);
	defineLazyInternal(inst, "values", (zod) => zod.def.innerType._zod.values);
	defineLazyInternal(inst, "optin", (zod) => zod.def.innerType?._zod?.optin);
	defineLazyInternal(inst, "optout", (zod) => zod.def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	if (!payload.memo) payload.value = Object.freeze(payload.value);
	return payload;
}
const $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/memoizer.js
var $ZodCyclicError = class extends Error {
	constructor() {
		super(`Cannot parse a reference cycle that closes through a transform`);
		this.name = "ZodCyclicError";
	}
};
/** Keyed off the context object every schema in one parse call already shares. */
const STATE = "~memo";
const NO_ISSUES = [];
function isRef(value) {
	return value !== null && typeof value === "object";
}
function cloneIssues(issues) {
	return issues.map((iss) => iss.path ? {
		...iss,
		path: iss.path.slice()
	} : { ...iss });
}
const recursive = /* @__PURE__ */ new WeakMap();
/** What the walk established, in order of certainty: ordered so the strongest answer among children wins. */
const NONE = 0;
const ASSUMED = 1;
const PROVEN = 2;
/** Whether this schema's subtree contains a cycle, so one parse can re-enter it. */
function isRecursive(inst, stack, resolve) {
	const cached = recursive.get(inst);
	if (cached !== void 0) return cached ? PROVEN : NONE;
	if (stack.has(inst)) return PROVEN;
	stack.add(inst);
	let result = NONE;
	const check = (child) => {
		if (result !== PROVEN && child?._zod) {
			const answer = isRecursive(child, stack, resolve);
			if (answer > result) result = answer;
		}
	};
	const shape = (sh, spread) => {
		let answer = NONE;
		for (const key of Reflect.ownKeys(sh)) {
			const desc = Object.getOwnPropertyDescriptor(sh, key);
			if (spread && !desc.enumerable) continue;
			const child = desc.get ? ASSUMED : desc.value?._zod ? isRecursive(desc.value, stack, resolve) : NONE;
			if (child > answer) answer = child;
		}
		return answer;
	};
	const merge = (answer) => {
		if (answer > result) result = answer;
	};
	const def = inst._zod.def;
	switch (def.type) {
		case "object": {
			const raw = rawShape(def);
			merge(raw ? shape(raw, true) : ASSUMED);
			check(def.catchall);
			break;
		}
		case "array":
			check(def.element);
			break;
		case "tuple":
			for (const el of def.items) check(el);
			check(def.rest);
			break;
		case "record":
		case "map":
			check(def.keyType);
			check(def.valueType);
			break;
		case "set":
			check(def.valueType);
			break;
		case "union":
			for (const el of def.options) check(el);
			break;
		case "intersection":
			check(def.left);
			check(def.right);
			break;
		case "optional":
		case "nullable":
		case "default":
		case "prefault":
		case "catch":
		case "readonly":
		case "nonoptional":
		case "promise":
		case "success":
			check(def.innerType);
			break;
		case "pipe":
			check(def.in);
			check(def.out);
			break;
		case "function":
			check(def.input);
			check(def.output);
			break;
		case "lazy": {
			const inner = def._cachedInner ?? (resolve ? inst._zod.innerType : void 0);
			merge(inner ? isRecursive(inner, stack, false) : ASSUMED);
			break;
		}
		case "template_literal":
		case "string":
		case "number":
		case "int":
		case "boolean":
		case "bigint":
		case "symbol":
		case "undefined":
		case "null":
		case "void":
		case "never":
		case "any":
		case "unknown":
		case "date":
		case "nan":
		case "enum":
		case "literal":
		case "file":
		case "transform":
		case "custom": break;
		default: for (const key in def) {
			const desc = Object.getOwnPropertyDescriptor(def, key);
			if (!desc || desc.get) continue;
			const value = desc.value;
			if (!value || typeof value !== "object") continue;
			if (value._zod) check(value);
			else if (Array.isArray(value)) for (const el of value) check(el);
		}
	}
	stack.delete(inst);
	return settle(inst, result);
}
/** An assumed answer must not outlive the resolution that settles it, so only a certain one is cached. */
function settle(inst, answer) {
	if (answer !== ASSUMED) recursive.set(inst, answer === PROVEN);
	return answer;
}
function bucketFor(state, inst) {
	let bucket = state.buckets.get(inst);
	if (!bucket) {
		bucket = /* @__PURE__ */ new WeakMap();
		state.buckets.set(inst, bucket);
	}
	return bucket;
}
let handoff;
const open = [];
const memo = {
	alloc(_inst, payload, empty) {
		const bucket = handoff;
		if (!bucket) return empty;
		handoff = void 0;
		const entry = {
			value: empty,
			issues: null
		};
		bucket.set(payload.value, entry);
		open.push(entry);
		return empty;
	},
	guard(inst) {
		var _a;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (ctx.direction !== "backward" && isBackEdge(ctx, payload.value)) throw new $ZodCyclicError();
				return base(payload, ctx);
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	},
	attach(inst) {
		var _a;
		let isRecursiveInst;
		let rechecked = false;
		let lastCtx;
		let lastBucket;
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred.push(() => {
			const base = inst._zod.parse;
			const wrapped = (payload, ctx) => {
				if (isRecursiveInst === void 0) {
					const walked = isRecursive(inst, /* @__PURE__ */ new Set(), false);
					if (walked === NONE) {
						inst._zod.parse = base;
						if (inst._zod.run === wrapped) inst._zod.run = base;
						return base(payload, ctx);
					}
					if (walked === PROVEN || rechecked) isRecursiveInst = true;
					else rechecked = true;
				}
				const input = payload.value;
				if (!isRef(input)) return base(payload, ctx);
				let state = ctx[STATE];
				if (!state) {
					state = {
						buckets: /* @__PURE__ */ new WeakMap(),
						backEdges: void 0
					};
					ctx[STATE] = state;
				}
				let bucket;
				if (lastCtx === ctx) bucket = lastBucket;
				else {
					bucket = bucketFor(state, inst);
					lastCtx = ctx;
					lastBucket = bucket;
				}
				const hit = bucket.get(input);
				if (hit) {
					payload.value = hit.value;
					if (hit.issues) {
						if (hit.issues.length) payload.issues.push(...cloneIssues(hit.issues));
					} else {
						payload.memo = true;
						state.backEdges ?? (state.backEdges = /* @__PURE__ */ new WeakSet());
						state.backEdges.add(hit.value);
					}
					return payload;
				}
				handoff = bucket;
				const depth = open.length;
				const result = base(payload, ctx);
				handoff = void 0;
				const entry = open.length > depth ? open.pop() : void 0;
				if (result instanceof Promise) return result.then((r) => {
					if (entry) entry.issues = r.issues.length ? cloneIssues(r.issues) : NO_ISSUES;
					return r;
				});
				if (entry) entry.issues = result.issues.length ? cloneIssues(result.issues) : NO_ISSUES;
				return result;
			};
			inst._zod.parse = wrapped;
			if (inst._zod.run === base) inst._zod.run = wrapped;
		});
	}
};
/** The memoizer that gives containers cycle support. `zod` installs it by default; `zod/mini` opts in with `config({ memoizer: memoizer() })`. */
function memoizer() {
	return memo;
}
/** Whether this value is a node a back-edge resolved to before it finished. */
function isBackEdge(ctx, value) {
	const backEdges = ctx[STATE]?.backEdges;
	return backEdges !== void 0 && isRef(value) && backEdges.has(value);
}

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/locales/en.js
const error = () => {
	const Sizable = {
		string: {
			unit: "characters",
			verb: "to have"
		},
		file: {
			unit: "bytes",
			verb: "to have"
		},
		array: {
			unit: "items",
			verb: "to have"
		},
		set: {
			unit: "items",
			verb: "to have"
		},
		map: {
			unit: "entries",
			verb: "to have"
		}
	};
	function getSizing(origin) {
		return Sizable[origin] ?? null;
	}
	const FormatDictionary = {
		regex: "input",
		email: "email address",
		url: "URL",
		emoji: "emoji",
		uuid: "UUID",
		uuidv4: "UUIDv4",
		uuidv6: "UUIDv6",
		nanoid: "nanoid",
		guid: "GUID",
		cuid: "cuid",
		cuid2: "cuid2",
		ulid: "ULID",
		xid: "XID",
		ksuid: "KSUID",
		datetime: "ISO datetime",
		date: "ISO date",
		time: "ISO time",
		duration: "ISO duration",
		ipv4: "IPv4 address",
		ipv6: "IPv6 address",
		mac: "MAC address",
		cidrv4: "IPv4 range",
		cidrv6: "IPv6 range",
		base64: "base64-encoded string",
		base64url: "base64url-encoded string",
		json_string: "JSON string",
		e164: "E.164 number",
		currency_code: "currency code",
		credit_card: "credit card number",
		iban: "IBAN",
		jwt: "JWT",
		template_literal: "input"
	};
	const TypeDictionary = { nan: "NaN" };
	function getTypeName(type, input) {
		if (type === "number" && typeof input === "number" && !Number.isFinite(input)) return String(input);
		return TypeDictionary[type] ?? type;
	}
	return (issue) => {
		switch (issue.code) {
			case "invalid_type": return `Invalid input: expected ${getTypeName(issue.expected)}, received ${getTypeName(parsedType(issue.input), issue.input)}`;
			case "invalid_value":
				if (issue.values.length === 1) return `Invalid input: expected ${stringifyPrimitive(issue.values[0])}`;
				return `Invalid option: expected one of ${joinValues(issue.values, "|")}`;
			case "too_big": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? "<=" : "<";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too big: expected ${issue.origin ?? "value"} to have ${adj}${issue.maximum.toString()} ${sizing.unit ?? "elements"}`;
				return `Too big: expected ${issue.origin ?? "value"} to be ${adj}${issue.maximum.toString()}`;
			}
			case "too_small": {
				const adj = issue.exact ? "exactly " : issue.inclusive ? ">=" : ">";
				const sizing = getSizing(issue.origin);
				if (sizing) return `Too small: expected ${issue.origin} to have ${adj}${issue.minimum.toString()} ${sizing.unit}`;
				return `Too small: expected ${issue.origin} to be ${adj}${issue.minimum.toString()}`;
			}
			case "invalid_format": {
				const _issue = issue;
				if (_issue.format === "starts_with") return `Invalid string: must start with "${_issue.prefix}"`;
				if (_issue.format === "ends_with") return `Invalid string: must end with "${_issue.suffix}"`;
				if (_issue.format === "includes") return `Invalid string: must include "${_issue.includes}"`;
				if (_issue.format === "regex") return `Invalid string: must match pattern ${_issue.pattern}`;
				return `Invalid ${FormatDictionary[_issue.format] ?? issue.format}`;
			}
			case "not_multiple_of": return `Invalid number: must be a multiple of ${issue.divisor}`;
			case "unrecognized_keys": return `Unrecognized key${issue.keys.length > 1 ? "s" : ""}: ${joinValues(issue.keys, ", ")}`;
			case "invalid_key": return `Invalid key in ${issue.origin}`;
			case "invalid_union":
				if (issue.options && Array.isArray(issue.options) && issue.options.length > 0) return `Invalid discriminator value. Expected ${issue.options.map((o) => `'${o}'`).join(" | ")}`;
				if (issue.inclusive === false) return "Invalid input: more than one option matched";
				return "Invalid input";
			case "invalid_element": return `Invalid value in ${issue.origin}`;
			default: return `Invalid input`;
		}
	};
};
function en_default() {
	return { localeError: error() };
}

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/api.js
function snapshotChecks(def) {
	if (def.checks) def.checks = [...def.checks];
	return def;
}
/* @__NO_SIDE_EFFECTS__ */
function _string(Class, params) {
	return new Class(snapshotChecks({
		type: "string",
		...normalizeParams(params)
	}));
}
/* @__NO_SIDE_EFFECTS__ */
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
/* @__NO_SIDE_EFFECTS__ */
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _number(Class, params) {
	return new Class(snapshotChecks({
		type: "number",
		checks: [],
		...normalizeParams(params)
	}));
}
/* @__NO_SIDE_EFFECTS__ */
function _int(Class, params) {
	return new Class({
		type: "number",
		check: "number_format",
		abort: false,
		format: "safeint",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
/* @__NO_SIDE_EFFECTS__ */
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _lt(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _lte(value, params) {
	return new $ZodCheckLessThan({
		check: "less_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _gt(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: false
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _gte(value, params) {
	return new $ZodCheckGreaterThan({
		check: "greater_than",
		...normalizeParams(params),
		value,
		inclusive: true
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _multipleOf(value, params) {
	return new $ZodCheckMultipleOf({
		check: "multiple_of",
		...normalizeParams(params),
		value
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
/* @__NO_SIDE_EFFECTS__ */
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
/* @__NO_SIDE_EFFECTS__ */
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
/* @__NO_SIDE_EFFECTS__ */
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
/* @__NO_SIDE_EFFECTS__ */
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
/* @__NO_SIDE_EFFECTS__ */
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
/* @__NO_SIDE_EFFECTS__ */
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/to-json-schema.js
function assignProps(target, ...sources) {
	for (const source of sources) for (const key of Reflect.ownKeys(source)) if (Object.prototype.propertyIsEnumerable.call(source, key)) assignProp(target, key, source[key]);
	return target;
}
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		sharedDefsExtractedFor: void 0,
		sharedEmitDoneFor: void 0,
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		intersections: [],
		deferred: [],
		external: params?.external ?? void 0
	};
}
/**
* Applies the `unrepresentable` setting at a site that has no JSON Schema equivalent. Throws
* `message` unless the setting (or the handler's return value) says otherwise. Returns `true` if a
* custom JSON Schema was written into `json`, in which case the caller must not write its own.
*/
function handleUnrepresentable(schema, ctx, json, params, message) {
	const result = typeof ctx.unrepresentable === "function" ? ctx.unrepresentable({
		zodSchema: schema,
		path: params.path,
		message
	}) : ctx.unrepresentable;
	if (result === "any") return false;
	if (result === void 0 || result === "throw") throw new Error(message);
	Object.assign(json, result);
	return true;
}
function processSchema(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	ctx.sharedDefsExtractedFor = void 0;
	ctx.sharedEmitDoneFor = void 0;
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			processSchema(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) assignProps(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function encodeJSONPointerSegment(segment) {
	return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	if (ctx.external && ctx.sharedDefsExtractedFor === ctx.external) return;
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${encodeJSONPointerSegment(id)}`
			};
		}
		const uriPrefix = `#`;
		const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
		if (entry[1] === root && !entry[1].schema.id) return { ref: uriPrefix };
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + encodeJSONPointerSegment(defId)
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") extractToDef(entry);
		}
	}
	if (ctx.external) ctx.sharedDefsExtractedFor = ctx.external;
}
/** Rewrites `anyOf: [{type: "a"}, {type: "b"}]` to `type: ["a", "b"]`, which every JSON Schema draft treats as equivalent and most consumers render far better for the nullable case. Only branches that are a bare type assertion qualify — anything carrying a constraint, `$ref`, `const` or metadata is left alone. Runs after `flattenRef`, so a branch an override decorated or `$defs` extraction turned into a `$ref` is no longer bare and correctly stays in `anyOf`. `oneOf` is excluded: `integer` and `number` overlap, so "exactly one" and "at least one" are not the same there. OpenAPI 3.0 is excluded: its `type` must be a single string. */
function compactTypeUnion(schema) {
	const options = schema.anyOf;
	if (!Array.isArray(options) || options.length === 0 || schema.type !== void 0) return;
	const types = [];
	for (const option of options) {
		if (!option || typeof option !== "object") return;
		compactTypeUnion(option);
		const keys = Object.keys(option);
		if (keys.length !== 1 || keys[0] !== "type") return;
		const type = option.type;
		for (const member of Array.isArray(type) ? type : [type]) {
			if (typeof member !== "string") return;
			if (!types.includes(member)) types.push(member);
		}
	}
	delete schema.anyOf;
	schema.type = types.length === 1 ? types[0] : types;
}
/** Keywords `foldIntersection` knows how to combine. Anything else — `$ref`, `patternProperties`,
* an annotation like `description` — makes a member unfoldable, so a constraint this does not
* understand leaves the `allOf` alone instead of being silently dropped or misattributed. */
const FOLDABLE_KEYS = new Set([
	"type",
	"properties",
	"required",
	"additionalProperties"
]);
const UNION_KEYS = ["oneOf", "anyOf"];
/** A member's constraint on a key it does not declare itself. A `catchall` states one; `false`, an absent `additionalProperties`, and the empty schema a loose object emits state nothing. */
function undeclaredConstraint(member) {
	const extra = member.additionalProperties;
	if (extra === void 0 || extra === false || typeof extra !== "object" || extra === null) return null;
	return Object.keys(extra).length ? extra : null;
}
/** Combines object members into the single object they describe together, or returns `null` if any of them carries a keyword outside {@link FOLDABLE_KEYS}. */
function foldObjects(members) {
	const objects = [];
	for (const member of members) {
		if (typeof member !== "object" || member.type !== "object") return null;
		for (const key in member) if (!FOLDABLE_KEYS.has(key)) return null;
		objects.push(member);
	}
	const properties = {};
	const required = /* @__PURE__ */ new Set();
	for (const object of objects) {
		for (const key in object.properties) {
			if (Object.prototype.hasOwnProperty.call(properties, key)) continue;
			const parts = [];
			for (const other of objects) {
				const part = other.properties?.[key] ?? undeclaredConstraint(other);
				if (part === null || part === void 0) continue;
				if (!parts.some((seen) => JSON.stringify(seen) === JSON.stringify(part))) parts.push(part);
			}
			assignProp(properties, key, parts.length === 1 ? parts[0] : foldObjects(parts) ?? { allOf: parts });
		}
		for (const key of object.required ?? []) required.add(key);
	}
	const folded = {
		type: "object",
		properties
	};
	if (required.size) folded.required = [...required];
	if (objects.every((object) => object.additionalProperties === false)) folded.additionalProperties = false;
	else {
		const constraints = [];
		for (const object of objects) {
			const constraint = undeclaredConstraint(object);
			if (constraint && !constraints.some((seen) => JSON.stringify(seen) === JSON.stringify(constraint))) constraints.push(constraint);
		}
		if (constraints.length === 1) folded.additionalProperties = constraints[0];
		else if (constraints.length > 1) folded.additionalProperties = { allOf: constraints };
	}
	return folded;
}
/** `additionalProperties` in an `allOf` member sees only that member's own `properties`, so two
* closed object members reject each other's keys and the schema validates nothing. Zod's parser
* pools the key sets instead — `handleIntersectionResults` reports a key as unrecognized only when
* *every* side rejects it — so the emitted schema has to pool them too, and folding the members
* into one object is the encoding that says so on every target.
*
* This runs from `finalize`, after `extractDefs`, which is what keeps it clear of the `$ref`
* machinery: a member extracted into `$defs` is already a `$ref` by now and declines to fold, so it
* keeps its reference and its own closedness rather than being inlined as a stale copy. */
function foldIntersection(json) {
	const allOf = json.allOf;
	if (!Array.isArray(allOf) || allOf.length < 2) return;
	for (const key of FOLDABLE_KEYS) if (key in json) return;
	const unions = allOf.filter((m) => UNION_KEYS.some((k) => Array.isArray(m[k])));
	let folded = null;
	if (!unions.length) folded = foldObjects(allOf);
	else {
		const union = unions[0];
		const keyword = UNION_KEYS.find((k) => Array.isArray(union[k]));
		if (Object.keys(union).length !== 1) return;
		const rest = allOf.filter((m) => m !== union);
		const branches = union[keyword].map((branch) => foldObjects([...rest, branch]));
		if (branches.some((b) => !b)) return;
		folded = { [keyword]: branches };
	}
	if (!folded) return;
	delete json.allOf;
	assignProps(json, folded);
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else assignProps(schema, refSchema);
			assignProps(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) {
		for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
		if (ctx.target !== "openapi-3.0") for (const entry of ctx.seen.entries()) compactTypeUnion(entry[1].def ?? entry[1].schema);
		for (const rewrite of ctx.deferred) rewrite();
		if (ctx.intersections.length) {
			const carriers = /* @__PURE__ */ new Map();
			for (const seen of ctx.seen.values()) for (const json of [seen.schema, seen.def]) {
				const allOf = json?.allOf;
				if (!Array.isArray(allOf)) continue;
				const existing = carriers.get(allOf);
				if (existing) existing.push(json);
				else carriers.set(allOf, [json]);
			}
			for (const allOf of ctx.intersections) for (const json of carriers.get(allOf) ?? []) foldIntersection(json);
		}
	}
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	assignProps(result, root.defId ? root.schema : root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	if (!ctx.external || ctx.sharedEmitDoneFor !== ctx.external) for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			assignProp(defs, seen.defId, seen.def);
		}
	}
	if (ctx.external) ctx.sharedEmitDoneFor = ctx.external;
	if (ctx.external) {} else if (Object.keys(defs).length > 0) if (ctx.target === "draft-2020-12") result.$defs = defs;
	else result.definitions = defs;
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault" || def.type === "catch") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	processSchema(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/core/json-schema-processors.js
const narrowMin = (agg, key, value) => {
	if (agg[key] === void 0 || value > agg[key]) agg[key] = value;
};
const narrowMax = (agg, key, value) => {
	if (agg[key] === void 0 || value < agg[key]) agg[key] = value;
};
const narrowBoth = (agg, value) => {
	narrowMin(agg, "minimum", value);
	narrowMax(agg, "maximum", value);
};
const addDivisor = (agg, value) => {
	agg.multipleOf ?? (agg.multipleOf = []);
	if (!agg.multipleOf.includes(value)) agg.multipleOf.push(value);
};
const addPattern = (agg, pattern) => {
	agg.patterns ?? (agg.patterns = /* @__PURE__ */ new Set());
	agg.patterns.add(pattern);
};
const intersectMime = (agg, mime) => {
	agg.mime = agg.mime ? agg.mime.filter((m) => mime.includes(m)) : [...mime];
};
const setFormat = (agg, format) => {
	agg.format = format;
	if (format.includes("int")) agg.isInt = true;
};
const minContributor = (agg, def) => narrowMin(agg, "minimum", def.minimum);
const maxContributor = (agg, def) => narrowMax(agg, "maximum", def.maximum);
const formatContributor = (ranges) => (agg, def) => {
	setFormat(agg, def.format);
	const [minimum, maximum] = ranges[def.format];
	narrowMin(agg, "minimum", minimum);
	narrowMax(agg, "maximum", maximum);
};
const contributors = {
	greater_than: (agg, def) => narrowMin(agg, def.inclusive ? "minimum" : "exclusiveMinimum", def.value),
	less_than: (agg, def) => narrowMax(agg, def.inclusive ? "maximum" : "exclusiveMaximum", def.value),
	multiple_of: (agg, def) => addDivisor(agg, def.value),
	number_format: formatContributor(NUMBER_FORMAT_RANGES),
	bigint_format: formatContributor(BIGINT_FORMAT_RANGES),
	min_length: minContributor,
	max_length: maxContributor,
	length_equals: (agg, def) => narrowBoth(agg, def.length),
	min_size: minContributor,
	max_size: maxContributor,
	size_equals: (agg, def) => narrowBoth(agg, def.size),
	string_format: (agg, def) => {
		setFormat(agg, def.format);
		if (def.pattern) addPattern(agg, def.pattern);
		if (def.format === "base64" || def.format === "base64url") agg.contentEncoding = def.format;
		if (def.local || def.precision === -1) agg.laxFormat = true;
	},
	mime_type: (agg, def) => intersectMime(agg, def.mime)
};
function aggregateChecks(schema) {
	const agg = {};
	const def = schema._zod.def;
	const list = schema._zod.traits.has("$ZodCheck") ? [schema, ...def.checks ?? []] : def.checks ?? [];
	for (const ch of list) contributors[ch._zod.def.check]?.(agg, ch._zod.def);
	const bag = schema._zod.bag;
	if (bag.minimum !== void 0) narrowMin(agg, "minimum", bag.minimum);
	if (bag.exclusiveMinimum !== void 0) narrowMin(agg, "exclusiveMinimum", bag.exclusiveMinimum);
	if (bag.maximum !== void 0) narrowMax(agg, "maximum", bag.maximum);
	if (bag.exclusiveMaximum !== void 0) narrowMax(agg, "exclusiveMaximum", bag.exclusiveMaximum);
	if (bag.multipleOf !== void 0) addDivisor(agg, bag.multipleOf);
	if (bag.format !== void 0) {
		agg.format ?? (agg.format = bag.format);
		if (bag.format.includes("int")) agg.isInt = true;
	}
	if (bag.mime) intersectMime(agg, bag.mime);
	for (const pattern of bag.patterns ?? []) addPattern(agg, pattern);
	return agg;
}
const formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
const exactPatterns = new Map([[base64Charset, base64], [base64urlCharset, base64url]]);
const exactPattern = (p) => exactPatterns.get(p) ?? p;
const stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding, laxFormat } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time" || laxFormat) delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const patternList = [...patterns].map(exactPattern);
		if (patternList.length === 1) json.pattern = patternList[0].source;
		else if (patternList.length > 1) json.allOf = [...patternList.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
const numberProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const { minimum, maximum, multipleOf, exclusiveMaximum, exclusiveMinimum, isInt } = aggregateChecks(schema);
	json.type = isInt ? "integer" : "number";
	const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
	const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
	const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
	if (exMin) if (legacy) {
		json.minimum = exclusiveMinimum;
		json.exclusiveMinimum = true;
	} else json.exclusiveMinimum = exclusiveMinimum;
	else if (typeof minimum === "number") json.minimum = minimum;
	if (exMax) if (legacy) {
		json.maximum = exclusiveMaximum;
		json.exclusiveMaximum = true;
	} else json.exclusiveMaximum = exclusiveMaximum;
	else if (typeof maximum === "number") json.maximum = maximum;
	if (multipleOf) {
		const divisors = /* @__PURE__ */ new Set();
		for (const divisor of multipleOf) if (Number.isFinite(divisor) && divisor !== 0) divisors.add(Math.abs(divisor));
		else handleUnrepresentable(schema, ctx, json, params, `A multipleOf divisor of ${divisor} cannot be represented in JSON Schema`);
		const [first, ...rest] = divisors;
		if (first !== void 0) json.multipleOf = first;
		if (rest.length) json.allOf = [...json.allOf ?? [], ...rest.map((m) => ({ multipleOf: m }))];
	}
};
const neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {};
const enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.length === 0) {
		json.not = {};
		return;
	}
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
const customProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Custom types cannot be represented in JSON Schema");
};
const transformProcessor = (schema, ctx, json, params) => {
	handleUnrepresentable(schema, ctx, json, params, "Transforms cannot be represented in JSON Schema");
};
const arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = aggregateChecks(schema);
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = processSchema(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
function inputOptin(schema) {
	const def = schema._zod.def;
	if (def.type === "pipe" && def.in._zod.traits.has("$ZodTransform")) return inputOptin(def.out);
	if (def.type === "catch") return inputOptin(def.innerType);
	return schema._zod.optin;
}
const objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const shape = def.shape;
	if (Object.getOwnPropertySymbols(shape).length && handleUnrepresentable(schema, ctx, json, params, "Symbol keys cannot be represented in JSON Schema")) return;
	json.type = "object";
	json.properties = {};
	for (const key in shape) assignProp(json.properties, key, processSchema(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	}));
	const requiredKeys = [];
	for (const key of Object.keys(shape)) {
		const field = def.shape[key];
		if (ctx.io === "input" ? inputOptin(field) === void 0 : field._zod.optout === void 0) requiredKeys.push(key);
	}
	if (requiredKeys.length > 0) json.required = requiredKeys;
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = processSchema(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
const unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => processSchema(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
const intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = processSchema(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = processSchema(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	const allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
	json.allOf = allOf;
	ctx.intersections.push(allOf);
};
/** JSON object keys are always strings, so a numeric record key schema is re-expressed over the
* numeric-string form the record parser matches. Deferred to `finalize`, after the flatten: a key
* behind a wrapper only carries its own `type` before then, and a union key only has its branches.
*
* A numeric bound cannot apply to a property name, so `minimum` and its siblings are dropped rather
* than carried over: keeping them beside `type: "string"` reproduces the match-nothing schema this
* exists to fix. A key that carries one therefore emits wider than the record parses — `z.record(z.number().min(5), V)`
* accepts `"3"` — which is the deliberate trade, since throwing on it would reject an ordinary schema
* outright. */
function stringifyKeyNames(bySchema, json, visited) {
	if (json.$ref) {
		if (visited.has(json)) return json;
		visited.add(json);
		const def = bySchema.get(json)?.def;
		if (!def) return json;
		const inlined = stringifyKeyNames(bySchema, def, visited);
		return inlined === def ? json : inlined;
	}
	for (const keyword of ["anyOf", "oneOf"]) {
		const branches = json[keyword];
		if (!Array.isArray(branches)) continue;
		const mapped = branches.map((branch) => stringifyKeyNames(bySchema, branch, visited));
		if (mapped.some((branch, i) => branch !== branches[i])) json = {
			...json,
			[keyword]: mapped
		};
	}
	const types = Array.isArray(json.type) ? json.type : [json.type];
	const numericType = !types.includes("string") && types.some((t) => t === "number" || t === "integer");
	const values = json.enum ?? (json.const !== void 0 ? [json.const] : void 0);
	if (!numericType && !values?.some((v) => typeof v === "number")) return json;
	const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, format, id, ...rest } = json;
	if (rest.enum) rest.enum = rest.enum.map((v) => typeof v === "number" ? String(v) : v);
	else if (typeof rest.const === "number") rest.const = String(rest.const);
	if (!numericType) return rest;
	rest.type = "string";
	if (!values) rest.pattern = (types.includes("number") ? number$1 : integer).source;
	return rest;
}
/** Every record of one conversion, so the carriers are found in a single pass rather than once per record. */
const pendingRecords = /* @__PURE__ */ new WeakMap();
function rewriteKeyNames(ctx) {
	const bySchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.values()) if (entry.def && !bySchema.has(entry.schema)) bySchema.set(entry.schema, entry);
	const rewrites = /* @__PURE__ */ new Map();
	for (const record of pendingRecords.get(ctx) ?? []) {
		const seen = ctx.seen.get(record);
		const names = (seen?.def ?? seen?.schema)?.propertyNames;
		if (!names || names === true || rewrites.has(names)) continue;
		const rewritten = stringifyKeyNames(bySchema, names, /* @__PURE__ */ new Set());
		if (rewritten !== names) rewrites.set(names, rewritten);
	}
	if (!rewrites.size) return;
	for (const entry of ctx.seen.values()) for (const carrier of [entry.schema, entry.def]) {
		const rewritten = carrier && rewrites.get(carrier.propertyNames);
		if (rewritten) carrier.propertyNames = rewritten;
	}
}
const recordProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	const keyType = def.keyType;
	const patterns = aggregateChecks(keyType).patterns;
	if (def.mode === "loose" && patterns && patterns.size > 0) {
		const valueSchema = processSchema(def.valueType, ctx, {
			...params,
			path: [
				...params.path,
				"patternProperties",
				"*"
			]
		});
		json.patternProperties = {};
		for (const pattern of patterns) assignProp(json.patternProperties, exactPattern(pattern).source, valueSchema);
	} else {
		if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
			json.propertyNames = processSchema(def.keyType, ctx, {
				...params,
				path: [...params.path, "propertyNames"]
			});
			let pending = pendingRecords.get(ctx);
			if (!pending) {
				pending = [];
				pendingRecords.set(ctx, pending);
				ctx.deferred.push(() => rewriteKeyNames(ctx));
			}
			pending.push(schema);
		}
		json.additionalProperties = processSchema(def.valueType, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	}
	const keyValues = keyType._zod.values;
	const omittableOnInput = ctx.io === "input" && inputOptin(def.valueType) !== void 0;
	if (keyValues && !def.partial && !omittableOnInput) {
		const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
		if (validKeyValues.length > 0) json.required = validKeyValues.map(String);
	}
};
const nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
/** Round-trips a default value through JSON so the emitted schema is guaranteed to be valid JSON.
* A BigInt has no reliable encoding, so it goes through `unrepresentable` like any other
* unrepresentable value. Returns a sentinel when the caller must not write a default of its own. */
const UNREPRESENTABLE_DEFAULT = Symbol();
function serializeDefaultValue(value, schema, ctx, json, params) {
	let unrepresentable = false;
	const serialized = JSON.stringify(value, (_, val) => {
		if (typeof val !== "bigint") return val;
		unrepresentable = true;
		return null;
	});
	if (!unrepresentable) return JSON.parse(serialized);
	handleUnrepresentable(schema, ctx, json, params, "BigInt defaults cannot be represented in JSON Schema");
	return UNREPRESENTABLE_DEFAULT;
}
const defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json.default = value;
};
const prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io !== "input") return;
	const value = serializeDefaultValue(def.defaultValue, schema, ctx, json, params);
	if (value !== UNREPRESENTABLE_DEFAULT) json._prefault = value;
};
const catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		handleUnrepresentable(schema, ctx, json, params, "Dynamic catch values are not supported in JSON Schema");
		return;
	}
	json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	processSchema(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	processSchema(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/classic/errors.js
const _installedErrorProtos = /* @__PURE__ */ new WeakSet([Object.prototype, Error.prototype]);
function _lazyMethod(proto, key, make) {
	Object.defineProperty(proto, key, {
		configurable: true,
		enumerable: false,
		get() {
			const value = make(this);
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
			return value;
		},
		set(value) {
			Object.defineProperty(this, key, {
				value,
				configurable: true,
				writable: true
			});
		}
	});
}
const initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	const proto = Object.getPrototypeOf(inst);
	if (_installedErrorProtos.has(proto)) return;
	_installedErrorProtos.add(proto);
	_lazyMethod(proto, "format", (self) => (mapper) => formatError(self, mapper));
	_lazyMethod(proto, "flatten", (self) => (mapper) => flattenError(self, mapper));
	_lazyMethod(proto, "addIssue", (self) => (issue) => {
		self.issues.push(issue);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	_lazyMethod(proto, "addIssues", (self) => (issues) => {
		self.issues.push(...issues);
		self.message = JSON.stringify(self.issues, jsonStringifyReplacer, 2);
	});
	Object.defineProperty(proto, "isEmpty", {
		configurable: true,
		enumerable: false,
		get() {
			return this.issues.length === 0;
		}
	});
};
const ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer, void 0, { Parent: Error });

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/classic/parse.js
const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

//#endregion
//#region node_modules/.pnpm/zod@4.6.5/node_modules/zod/v4/classic/schemas.js
function _ensureDefaultLocale() {
	if (!globalConfig.localeError) config(en_default());
}
function _ensureDefaultMemoizer() {
	if (!globalConfig.memoizer) config({ memoizer: memoizer() });
}
const ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
	_ensureDefaultLocale();
	$ZodType.init(inst, def);
	inst.def = def;
	inst.type = def.type;
	return inst;
}, {
	check(...chks) {
		const def = this.def;
		return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
			check: ch,
			def: { check: "custom" },
			onattach: []
		} } : ch)] }), { parent: true });
	},
	with(...chks) {
		return this.check(...chks);
	},
	clone(def, params) {
		return clone(this, def, params);
	},
	brand() {
		return this;
	},
	register(reg, meta) {
		reg.add(this, meta);
		return this;
	},
	refine(check, params) {
		return this.check(refine(check, params));
	},
	superRefine(refinement, params) {
		return this.check(superRefine(refinement, params));
	},
	overwrite(fn) {
		return this.check(_overwrite(fn));
	},
	optional() {
		return optional(this);
	},
	exactOptional() {
		return exactOptional(this);
	},
	nullable() {
		return nullable(this);
	},
	nullish() {
		return optional(nullable(this));
	},
	nonoptional(params) {
		return nonoptional(this, params);
	},
	array() {
		return array(this);
	},
	or(arg) {
		return union([this, arg]);
	},
	and(arg) {
		return intersection(this, arg);
	},
	transform(tx) {
		return pipe(this, transform(tx));
	},
	default(d) {
		return _default(this, d);
	},
	prefault(d) {
		return prefault(this, d);
	},
	catch(params) {
		return _catch(this, params);
	},
	pipe(target) {
		return pipe(this, target);
	},
	readonly() {
		return readonly(this);
	},
	describe(description) {
		const cl = this.clone();
		globalRegistry.add(cl, { description });
		return cl;
	},
	meta(...args) {
		if (args.length === 0) return globalRegistry.get(this);
		const cl = this.clone();
		globalRegistry.add(cl, args[0]);
		return cl;
	},
	isOptional() {
		return this.safeParse(void 0).success;
	},
	isNullable() {
		return this.safeParse(null).success;
	},
	apply(fn, ...args) {
		return args.length === 0 ? fn(this) : fn(this, ...args);
	},
	get "~standard"() {
		return hide(this, "~standard", {
			...standardProps(this),
			jsonSchema: {
				input: createStandardJSONSchemaMethod(this, "input"),
				output: createStandardJSONSchemaMethod(this, "output")
			}
		});
	},
	set "~standard"(value) {
		own(this, "~standard", value);
	},
	parse: function _parse(data, params) {
		return parse(this, data, params, { callee: _parse });
	},
	parseAsync: async function _parseAsync(data, params) {
		return await parseAsync(this, data, params, { callee: _parseAsync });
	},
	safeParse(data, params) {
		return safeParse(this, data, params);
	},
	async safeParseAsync(data, params) {
		return safeParseAsync(this, data, params);
	},
	get spa() {
		return this?.safeParseAsync;
	},
	set spa(value) {
		own(this, "spa", value);
	},
	validate(data, params) {
		return validate(this, data, params);
	},
	validateAsync(data, params) {
		return validateAsync$1(this, data, params);
	},
	encode: function _encode(data, params) {
		return encode(this, data, params, { callee: _encode });
	},
	decode: function _decode(data, params) {
		return decode(this, data, params, { callee: _decode });
	},
	encodeAsync: async function _encodeAsync(data, params) {
		return await encodeAsync(this, data, params, { callee: _encodeAsync });
	},
	decodeAsync: async function _decodeAsync(data, params) {
		return await decodeAsync(this, data, params, { callee: _decodeAsync });
	},
	safeEncode(data, params) {
		return safeEncode(this, data, params);
	},
	safeDecode(data, params) {
		return safeDecode(this, data, params);
	},
	async safeEncodeAsync(data, params) {
		return safeEncodeAsync(this, data, params);
	},
	async safeDecodeAsync(data, params) {
		return safeDecodeAsync(this, data, params);
	},
	toJSONSchema(params) {
		return createToJSONSchemaMethod(this, {})(params);
	},
	get description() {
		return globalRegistry.get(this)?.description;
	},
	get _def() {
		return this._zod.def;
	}
});
/** @internal */
const _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
}, /* @__PURE__ */ derived({
	format: (inst) => aggregateChecks(inst).format ?? null,
	minLength: (inst) => aggregateChecks(inst).minimum ?? null,
	maxLength: (inst) => aggregateChecks(inst).maximum ?? null
}, {
	regex(...args) {
		return this.check(_regex(...args));
	},
	includes(...args) {
		return this.check(_includes(...args));
	},
	startsWith(...args) {
		return this.check(_startsWith(...args));
	},
	endsWith(...args) {
		return this.check(_endsWith(...args));
	},
	min(...args) {
		return this.check(_minLength(...args));
	},
	max(...args) {
		return this.check(_maxLength(...args));
	},
	length(...args) {
		return this.check(_length(...args));
	},
	nonempty(...args) {
		return this.check(_minLength(1, ...args));
	},
	lowercase(params) {
		return this.check(_lowercase(params));
	},
	uppercase(params) {
		return this.check(_uppercase(params));
	},
	trim() {
		return this.check(_trim());
	},
	normalize(...args) {
		return this.check(_normalize(...args));
	},
	toLowerCase() {
		return this.check(_toLowerCase());
	},
	toUpperCase() {
		return this.check(_toUpperCase());
	},
	slugify() {
		return this.check(_slugify());
	}
}));
const ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
}, {
	email(params) {
		return this.check(_email(ZodEmail, params));
	},
	url(params) {
		return this.check(_url(ZodURL, params));
	},
	jwt(params) {
		return this.check(_jwt(ZodJWT, params));
	},
	emoji(params) {
		return this.check(_emoji(ZodEmoji, params));
	},
	guid(params) {
		return this.check(_guid(ZodGUID, params));
	},
	uuid(params) {
		return this.check(_uuid(ZodUUID, params));
	},
	uuidv4(params) {
		return this.check(_uuidv4(ZodUUID, params));
	},
	uuidv6(params) {
		return this.check(_uuidv6(ZodUUID, params));
	},
	uuidv7(params) {
		return this.check(_uuidv7(ZodUUID, params));
	},
	nanoid(params) {
		return this.check(_nanoid(ZodNanoID, params));
	},
	cuid(params) {
		return this.check(_cuid(ZodCUID, params));
	},
	cuid2(params) {
		return this.check(_cuid2(ZodCUID2, params));
	},
	ulid(params) {
		return this.check(_ulid(ZodULID, params));
	},
	base64(params) {
		return this.check(_base64(ZodBase64, params));
	},
	base64url(params) {
		return this.check(_base64url(ZodBase64URL, params));
	},
	xid(params) {
		return this.check(_xid(ZodXID, params));
	},
	ksuid(params) {
		return this.check(_ksuid(ZodKSUID, params));
	},
	ipv4(params) {
		return this.check(_ipv4(ZodIPv4, params));
	},
	ipv6(params) {
		return this.check(_ipv6(ZodIPv6, params));
	},
	cidrv4(params) {
		return this.check(_cidrv4(ZodCIDRv4, params));
	},
	cidrv6(params) {
		return this.check(_cidrv6(ZodCIDRv6, params));
	},
	e164(params) {
		return this.check(_e164(ZodE164, params));
	},
	datetime(params) {
		return this.check(_isoDateTime(ZodISODateTime, params));
	},
	date(params) {
		return this.check(_isoDate(ZodISODate, params));
	},
	time(params) {
		return this.check(_isoTime(ZodISOTime, params));
	},
	duration(params) {
		return this.check(_isoDuration(ZodISODuration, params));
	}
});
function string(params) {
	return _string(ZodString, params);
}
const ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
const ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
	$ZodNumber.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json, params);
	inst.isFinite = true;
}, /* @__PURE__ */ derived({
	minValue: (inst) => {
		const { minimum, exclusiveMinimum } = aggregateChecks(inst);
		return Math.max(minimum ?? Number.NEGATIVE_INFINITY, exclusiveMinimum ?? Number.NEGATIVE_INFINITY);
	},
	maxValue: (inst) => {
		const { maximum, exclusiveMaximum } = aggregateChecks(inst);
		return Math.min(maximum ?? Number.POSITIVE_INFINITY, exclusiveMaximum ?? Number.POSITIVE_INFINITY);
	},
	isInt: (inst) => {
		const { isInt, multipleOf } = aggregateChecks(inst);
		return !!isInt || !!multipleOf?.some(Number.isSafeInteger);
	},
	format: (inst) => aggregateChecks(inst).format ?? null
}, {
	gt(value, params) {
		return this.check(_gt(value, params));
	},
	gte(value, params) {
		return this.check(_gte(value, params));
	},
	min(value, params) {
		return this.check(_gte(value, params));
	},
	lt(value, params) {
		return this.check(_lt(value, params));
	},
	lte(value, params) {
		return this.check(_lte(value, params));
	},
	max(value, params) {
		return this.check(_lte(value, params));
	},
	int(params) {
		return this.check(int(params));
	},
	safe(params) {
		return this.check(int(params));
	},
	positive(params) {
		return this.check(_gt(0, params));
	},
	nonnegative(params) {
		return this.check(_gte(0, params));
	},
	negative(params) {
		return this.check(_lt(0, params));
	},
	nonpositive(params) {
		return this.check(_lte(0, params));
	},
	multipleOf(value, params) {
		return this.check(_multipleOf(value, params));
	},
	step(value, params) {
		return this.check(_multipleOf(value, params));
	},
	finite() {
		return this;
	}
}));
function number(params) {
	return _number(ZodNumber, params);
}
const ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
	$ZodNumberFormat.init(inst, def);
	ZodNumber.init(inst, def);
});
function int(params) {
	return _int(ZodNumberFormat, params);
}
const ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
});
function unknown() {
	return _unknown(ZodUnknown);
}
const ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return _never(ZodNever, params);
}
const ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
}, {
	min(n, params) {
		return this.check(_minLength(n, params));
	},
	nonempty(params) {
		return this.check(_minLength(1, params));
	},
	max(n, params) {
		return this.check(_maxLength(n, params));
	},
	length(n, params) {
		return this.check(_length(n, params));
	},
	unwrap() {
		return this.element;
	}
});
function array(element, params) {
	return _array(ZodArray, element, params);
}
const ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	installLazyProp(inst, "shape", (self) => self._zod.def.shape, false);
}, {
	keyof() {
		return _enum(Object.keys(this._zod.def.shape));
	},
	catchall(catchall) {
		return this.clone(mergeDefs(this._zod.def, { catchall }));
	},
	passthrough() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	loose() {
		return this.clone(mergeDefs(this._zod.def, { catchall: unknown() }));
	},
	strict() {
		return this.clone(mergeDefs(this._zod.def, { catchall: never() }));
	},
	strip() {
		return this.clone(mergeDefs(this._zod.def, { catchall: void 0 }));
	},
	extend(incoming) {
		return extend(this, incoming);
	},
	safeExtend(incoming) {
		return safeExtend(this, incoming);
	},
	merge(other) {
		return merge(this, other);
	},
	pick(mask) {
		return pick(this, mask);
	},
	omit(mask) {
		return omit(this, mask);
	},
	partial(...args) {
		return partial(ZodOptional, this, args[0]);
	},
	exactPartial(...args) {
		return partial(ZodExactOptional, this, args[0], "exactPartial");
	},
	required(...args) {
		return required(ZodNonOptional, this, args[0]);
	}
});
function object(shape, params) {
	return new ZodObject({
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	});
}
const ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
const ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
const ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodRecord.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
	inst.keyType = def.keyType;
	inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
	if (!valueType || !valueType._zod) return new ZodRecord({
		type: "record",
		keyType: string(),
		valueType: keyType,
		...normalizeParams(valueType)
	});
	return new ZodRecord({
		type: "record",
		keyType,
		valueType,
		...normalizeParams(params)
	});
}
const ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = [...inst._zod.values];
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	return new ZodEnum({
		type: "enum",
		entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
		...normalizeParams(params)
	});
}
const ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
	_ensureDefaultMemoizer();
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				if (!("input" in _issue)) _issue.input = payload.value;
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			return payload;
		});
		payload.value = output;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
const ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
const ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
const ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
const ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
const ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : constantCatch(catchValue)
	});
}
const ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
const ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
const ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
	return _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return _superRefine(fn, params);
}

//#endregion
//#region node_modules/.pnpm/opencc-js@1.4.2/node_modules/opencc-js/dist/esm/t2cn.js
var n = class {
	constructor() {
		this.map = /* @__PURE__ */ new Map();
	}
	addWord(n, t) {
		let { map: e } = this;
		for (const t of n) {
			const n = t.codePointAt(0), r = e.get(n);
			if (null == r) {
				const t = /* @__PURE__ */ new Map();
				e.set(n, t), e = t;
			} else e = r;
		}
		e.trie_val = t;
	}
	loadDict(n) {
		if ("string" == typeof n) {
			n = n.split("|");
			for (const t of n) {
				const [n, e] = t.split(" ");
				if ("string" != typeof e) throw new TypeError("Invalid dictionary entry: expected string entries to use \"source replacement\" format.");
				this.addWord(n, e);
			}
		} else for (const t of n) {
			if (!Array.isArray(t) || "string" != typeof t[0] || "string" != typeof t[1]) throw new TypeError("Invalid dictionary entry: expected [source, replacement] pairs. If you are passing locale dictionaries to ConverterFactory, spread them, for example: ConverterFactory(...Locale.from.cn, ...Locale.to.hk).");
			const [n, e] = t;
			this.addWord(n, e);
		}
	}
	loadDictGroup(n) {
		n.slice().reverse().forEach((n) => {
			this.loadDict(n);
		});
	}
	matchPrefix(n, t) {
		const e = n.length;
		let r, o = this.map, i = 0;
		for (let a = t; a < e;) {
			const t = n.codePointAt(a);
			a += t > 65535 ? 2 : 1;
			const e = o.get(t);
			if (void 0 === e) break;
			o = e;
			const l = o.trie_val;
			void 0 !== l && (i = a, r = l);
		}
		return i > 0 ? {
			end: i,
			value: r
		} : null;
	}
	segment(n) {
		const t = n.length, e = [];
		let o = null;
		for (let i = 0; i < t;) {
			const t = this.matchPrefix(n, i);
			t ? (null !== o && (e.push(n.slice(o, i)), o = null), e.push(n.slice(i, t.end)), i = t.end) : (null === o && (o = i), i += r(n, i));
		}
		return null !== o && e.push(n.slice(o, t)), e;
	}
	convert(n) {
		const t = n.length, e = [];
		let o = null;
		for (let i = 0; i < t;) {
			const t = this.matchPrefix(n, i);
			t ? (null !== o && (e.push(n.slice(o, i)), o = null), e.push(t.value), i = t.end) : (null === o && (o = i), i += r(n, i));
		}
		return null !== o && e.push(n.slice(o, t)), e.join("");
	}
};
function t(n, t) {
	return n.codePointAt(t) > 65535 ? 2 : 1;
}
function e(n, r) {
	const o = function(n) {
		return n >= 12272 && n <= 12273 ? 2 : n >= 12274 && n <= 12275 ? 3 : n >= 12276 && n <= 12287 ? 2 : 0;
	}(n.codePointAt(r));
	if (0 === o) return 0;
	let i = r + t(n, r);
	for (let r = 0; r < o; r += 1) {
		if (i >= n.length) return 0;
		i = e(n, i) || i + t(n, i);
	}
	return i;
}
function r(n, r) {
	const o = e(n, r);
	return o > r ? o - r : t(n, r);
}
function o(...t) {
	const e = function(n) {
		return n.flatMap((n) => {
			if (function(n) {
				return Array.isArray(n) && n.every(l);
			}(n)) return n;
			if (l(n)) return [n];
			if (!Array.isArray(n)) throw new TypeError("Invalid ConverterFactory argument: expected a dictionary group or locale dictionary collection.");
			const t = [];
			let e = 0;
			for (; e < n.length && l(n[e]);) t.push(n[e].slice()), e += 1;
			const r = n.slice(e);
			return t.length > 0 && r.length > 0 && r.every(a) ? (t[t.length - 1].push(...r), t) : [n];
		});
	}(t).map((t) => {
		const e = new n();
		return e.loadDictGroup(t), e;
	});
	return function(n) {
		return e.reduce((n, t) => t.convert(n), n);
	};
}
function i(n) {
	return Array.isArray(n) && "string" == typeof n[0] && "string" == typeof n[1];
}
function a(n) {
	return "string" == typeof n || Array.isArray(n) && n.every(i);
}
function l(n) {
	return Array.isArray(n) && n.every((n) => function(n) {
		return "string" == typeof n && ("" === n || n.includes(" "));
	}(n) || Array.isArray(n) && n.every(i));
}
var u = "一口吃個 一口喫個|一口吃成 一口喫成|一家三口 一家三口|一家五口 一家五口|一家六口 一家六口|一家四口 一家四口|一針 一針|一針見血 一針見血|三針 三針|丟巧針 丟巧針|丹稜 丹稜|九針 九針|亂針繡 亂針繡|仙台 仙台|倒扣針兒 倒扣針兒|做針線 做針線|八字方針 八字方針|刀割針扎 刀割針扎|分針 分針|別針 別針|刺胳針 刺胳針|刺針 刺針|北港島綫 北港島線|十針 十針|南港島綫 南港島線|南針 南針|反時針 反時針|口吃 口吃|台山 台山|台山市 台山市|台州 台州|台州地區 台州地區|台州市 台州市|吃口 喫口|吃口令 吃口令|吃口飯 喫口飯|吃吃 喫喫|吃子 喫子|向風針 向風針|唱針 唱針|啄針兒 啄針兒|嗎啡針 嗎啡針|大政方針 大政方針|大海撈針 大海撈針|大頭針 大頭針|天台 天台|天台女 天台女|天台宗 天台宗|天台山 天台山|天台縣 天台縣|太乙神針 太乙神針|奇台 奇台|女人心海底針 女人心海底針|定南針 定南針|定風針 定風針|將軍澳綫 將軍澳線|對針 對針|小針 小針|小針美容 小針美容|屯馬綫 屯馬線|平針縫 平針縫|幾針 幾針|引線穿針 引線穿針|張口 張口|張柏芝 張柏芝|張栢芝 張栢芝|張飛穿針 張飛穿針|強心針 強心針|弼針 弼針|彈針 彈針|懸針 懸針|懸針垂露 懸針垂露|手腕式指北針 手腕式指北針|扎針 扎針|打完針 打完針|打針 打針|披針形葉 披針形葉|抵針 抵針|拈針指 拈針指|指北針 指北針|指南針 指南針|指揮台 指揮台|指針 指針|指針式 指針式|探針 探針|控制台 控制台|插針 插針|搖針 搖針|搗針 搗針|撞針 撞針|擺針 擺針|收針 收針|教育方針 教育方針|敹一針 敹一針|方針 方針|時針 時針|暈針 暈針|曲別針 曲別針|東九龍綫 東九龍線|東海撈針 東海撈針|東涌綫 東涌線|東鐵綫 東鐵線|松針 松針|枝針 枝針|桑針 桑針|棒針 棒針|棒針衫 棒針衫|棘針 棘針|棘針科 棘針科|棘針門 棘針門|機場快綫 機場快線|步線行針 步線行針|毒針 毒針|毛線針 毛線針|毫針 毫針|水底撈針 水底撈針|沙中綫 沙中線|注射針 注射針|注射針頭 注射針頭|洗面皂 洗面皂|洗髮皂 洗髮皂|浙江天台縣 浙江天台縣|海底撈針 海底撈針|港島綫 港島線|漏針 漏針|炮台山循道衛理中學 炮台山循道衛理中學|無線新聞台 無線新聞台|無針不引線 無針不引線|無針注射器 無針注射器|燔針 燔針|留針 留針|皂化 皂化|皂莢 皂莢|皂莢樹 皂莢樹|皂角 皂角|短針 短針|石針 石針|硬肥皂 硬肥皂|磁針 磁針|磨杵成針 磨杵成針|磨針溪 磨針溪|磨鐵成針 磨鐵成針|秒針 秒針|秧針 秧針|穆稜 穆稜|穿針 穿針|穿針引線 穿針引線|穿針走線 穿針走線|紋光針 紋光針|細針密縷 細針密縷|絞包針 絞包針|給個棒錘當針認 給個棒錘當針認|綏稜 綏稜|綿裏藏針 綿裏藏針|綿裏針 綿裏針|縫衣針 縫衣針|縫針 縫針|縫針補線 縫針補線|縫針跡 縫針跡|總方針 總方針|繃針 繃針|繡花針 繡花針|繡花針兒 繡花針兒|繡針 繡針|羅盤針 羅盤針|美白針 美白針|耳針 耳針|肥皂 肥皂|肥皂劇 肥皂劇|肥皂泡 肥皂泡|肥皂粉 肥皂粉|肥皂絲 肥皂絲|肥皂莢 肥皂莢|胃口 胃口|胸針 胸針|臺灣台 臺灣台|船不漏針漏針沒外人 船不漏針漏針沒外人|花兒針 花兒針|茅針 茅針|荃灣綫 荃灣線|葉針 葉針|藏針縫 藏針縫|藥皂 藥皂|藥針 藥針|蛇口蜂針 蛇口蜂針|螫針 螫針|蠻針瞎灸 蠻針瞎灸|補血針 補血針|補針 補針|見縫插針 見縫插針|觀塘綫 觀塘線|討針線 討針線|象牙針尖 象牙針尖|賀爾蒙針 賀爾蒙針|跳針 跳針|蹇吃 蹇吃|軟肥皂 軟肥皂|迪士尼綫 迪士尼線|迴紋針 迴紋針|退針 退針|逆時針 逆時針|避雷針 避雷針|郭台成 郭台成|郭台銘 郭台銘|鄧艾吃 鄧艾吃|金針 金針|金針山 金針山|金針度人 金針度人|金針花 金針花|金針菇 金針菇|金針菜 金針菜|釘書針 釘書針|針具 針具|針刺 針刺|針刺麻醉 針刺麻醉|針劑 針劑|針孔 針孔|針孔攝影機 針孔攝影機|針孔照像 針孔照像|針孔照像機 針孔照像機|針孔現象 針孔現象|針對 針對|針對性 針對性|針對於 針對於|針尖 針尖|針尖兒 針尖兒|針工 針工|針布 針布|針形葉 針形葉|針指 針指|針挑刀挖 針挑刀挖|針梳機 針梳機|針氈 針氈|針法 針法|針炙 針炙|針狀 針狀|針狀物 針狀物|針盤 針盤|針眼 針眼|針眼子 針眼子|針神 針神|針筆 針筆|針筆匠 針筆匠|針筒 針筒|針箍 針箍|針箍兒 針箍兒|針線 針線|針線包 針線包|針線娘 針線娘|針線活 針線活|針線活計 針線活計|針線盒 針線盒|針線箔籬 針線箔籬|針織 針織|針織品 針織品|針織廠 針織廠|針織料 針織料|針腳 針腳|針葉 針葉|針葉林 針葉林|針葉植物 針葉植物|針葉樹 針葉樹|針針見血 針針見血|針釦 針釦|針鋒 針鋒|針鋒相對 針鋒相對|針鋒相投 針鋒相投|針鋩 針鋩|針頭 針頭|針餌莫減 針餌莫減|針骨 針骨|針魚 針魚|針黹 針黹|針黹紡績 針黹紡績|針鼴 針鼴|針鼻 針鼻|針鼻兒 針鼻兒|釦針 釦針|鉤針 鉤針|銀針 銀針|鋼針 鋼針|錶針 錶針|鐵針 鐵針|長針 長針|開口 開口|防疫針 防疫針|電唱針 電唱針|電針 電針|電針麻醉 電針麻醉|面皂 面皂|頂針 頂針|頂針兒 頂針兒|頂針捱住 頂針捱住|頂門針 頂門針|順時針 順時針|預防針 預防針|領帶針 領帶針|風向針 風向針|飛針走線 飛針走線|香皂 香皂|骨針 骨針|髮針 髮針|鬼針草 鬼針草|鳳台 鳳台|鹽水針 鹽水針|麻醉針 麻醉針|黃成 黃成|鼻針療法 鼻針療法|齧蘗吞針 齧蘗吞針|龍應台 龍應台", g = "偽 僞|兑 兌|卧 臥|叁 叄|台 臺|吃 喫|唇 脣|啟 啓|囱 囪|媪 媼|媯 嬀|悦 悅|愠 慍|户 戶|捝 挩|揾 搵|敍 敘|敚 敓|枱 檯|枴 柺|棁 梲|榅 榲|氲 氳|涚 涗|温 溫|溈 潙|潀 潨|濕 溼|灶 竈|為 爲|煴 熅|痴 癡|皂 皁|眾 衆|秘 祕|税 稅|稜 棱|粧 妝|粽 糉|糭 糉|綫 線|緼 縕|缽 鉢|脱 脫|腽 膃|葱 蔥|蒀 蒕|蒍 蔿|藴 蘊|蜕 蛻|衞 衛|衹 只|説 說|踴 踊|輼 轀|醖 醞|針 鍼|鈎 鉤|鋭 銳|閲 閱|鰛 鰮", f = "丹尼·波爾 丹尼·博伊爾|伊利諾 伊利諾伊|伊利諾州 伊利諾伊州|伊力·卡山 伊利亞·卡贊|伺服器 服務器|佐治·古尼 喬治·克魯尼|作業系統 操作系統|保羅·夏傑斯 保羅·哈吉斯|保羅·湯馬士·安德遜 保羅·托馬斯·安德森|北卡羅萊納 北卡羅來納|北卡羅萊納州 北卡羅來納州|南卡羅萊納 南卡羅來納|南卡羅萊納州 南卡羅來納州|占士·金馬倫 詹姆斯·卡梅隆|古利姆·迪托路 吉列爾莫·德爾托羅|史提夫·麥昆 史蒂夫·麥奎因|史提芬·史匹堡 斯蒂芬·斯皮爾伯格|嘉芙蓮·碧格露 凱瑟琳·畢格羅|基斯杜化·路蘭 克里斯托弗·諾蘭|大衛·連 大衛·利恩|奇連·伊士活 克林特·伊斯特伍德|奇雲·高士拿 凱文·科斯特納|奧克拉荷馬 俄克拉何馬|奧克拉荷馬州 俄克拉何馬州|奧利華·史東 奧利弗·斯通|威廉·佛烈金 威廉·弗萊德金|密芝根 密歇根|密芝根州 密歇根州|寬頻 寬帶|彼德·積遜 彼得·傑克遜|德薩斯 得克薩斯|德薩斯州 得克薩斯州|愛瑪·湯馬士 艾瑪·托馬斯|愛黛兒·羅曼斯基 阿黛爾·羅曼斯基|搜尋 搜索|朗·侯活 朗·霍華德|查理士·路雲 查爾斯·羅文|梳芙厘 舒芙蕾|森·曼特斯 山姆·曼德斯|概率 概率|機會率 概率|機率 幾率|法蘭絲·麥杜雯 弗朗西絲·麥克多曼德|活地·亞倫 伍迪·艾倫|游標 光標|湯賀柏 湯姆·霍伯|滑鼠 鼠標|珍·甘比茵 簡·坎皮恩|畢·彼特 布拉德·皮特|硬碟 硬盤|私隱權 隱私權|程式語言 編程語言|米克·尼高斯 邁克·尼科爾斯|米路·吉遜 梅爾·吉布森|米高·哈薩拿維斯 米歇爾·阿扎納維西於斯|米高·德格拉斯 邁克爾·道格拉斯|約瑟·曼基威士 約瑟夫·曼凱維奇|維珍尼亞 弗吉尼亞|維珍尼亞州 弗吉尼亞州|羅德島 羅得島|羅德島州 羅得島州|羅拔·淮斯 羅伯特·懷斯|羅拔·湛米基斯 羅伯特·澤米吉斯|羅拔·烈福 羅伯特·雷德福|艾力謝路·高沙里斯·依拿力圖 亞歷杭德羅·岡薩雷斯·伊納裏圖|華倫·比提 沃倫·比蒂|西維珍尼亞 西弗吉尼亞|西維珍尼亞州 西弗吉尼亞州|記憶體模組 內存條|資料夾 文件夾|賓·艾佛力 本·阿弗萊克|賓夕凡尼亞 賓夕法尼亞|賓夕凡尼亞州 賓夕法尼亞州|路蘭 諾蘭|辛·貝克 肖恩·貝克|馬利蘭 馬里蘭|馬利蘭州 馬里蘭州|馬田·史高西斯 馬丁·斯科塞斯|高安兄弟 科恩兄弟", d = "一口吃個 一口喫個|一口吃成 一口喫成|一家三口 一家三口|一家五口 一家五口|一家六口 一家六口|一家四口 一家四口|一展長才 一展長才|一流人才 一流人才|一表人才 一表人才|一針 一針|一針見血 一針見血|七步之才 七步之才|七步奇才 七步奇才|三才 三才|三才圖會 三才圖會|三針 三針|上梁 上樑|上梁不正 上樑不正|上梁不正下梁歪 上樑不正下樑歪|上梁文 上樑文|下才 下才|下梁 下樑|不成才 不成才|不才 不才|不打不成才 不打不成才|不良才 不良才|丟巧針 丟巧針|中才 中才|中核 中核|丹稜 丹稜|主梁 主樑|之核 之核|九針 九針|乾奴才 乾奴才|亂針繡 亂針繡|二流人才 二流人才|亞核 亞核|人才 人才|人才出衆 人才出衆|人才外流 人才外流|人才庫 人才庫|人才流失 人才流失|人才濟濟 人才濟濟|人才輩出 人才輩出|人才難得 人才難得|人盡其才 人盡其才|什么 什麼|仙才 仙才|伊核 伊核|作育英才 作育英才|佳人才子 佳人才子|個核 個核|倒了核桃車子 倒了核桃車子|倒扣針兒 倒扣針兒|偏才 偏才|做針線 做針線|偷梁換柱 偷樑換柱|傲世輕才 傲世輕才|僅作參考 僅作參考|僅供參考 僅供參考|儲訓人才 儲訓人才|光脊梁 光脊樑|免參 免參|內參 內參|內核 內核|全才 全才|全程參加 全程參加|全面禁止核試驗條約 全面禁止核試驗條約|八字方針 八字方針|八斗之才 八斗之才|八斗才 八斗才|公才公望 公才公望|公衆參與 公衆參與|六才子書 六才子書|其核 其核|冠世之才 冠世之才|冰核 冰核|几案之才 几案之才|凡才 凡才|出倫之才 出倫之才|刀割針扎 刀割針扎|分針 分針|初露才華 初露才華|別針 別針|利弊參半 利弊參半|刺股懸梁 刺股懸樑|刺胳針 刺胳針|刺針 刺針|刺骨懸梁 刺骨懸樑|剋核 剋核|前核 前核|力薄才疏 力薄才疏|功過參半 功過參半|動如參商 動如參商|匡濟之才 匡濟之才|十針 十針|千噸級核武器 千噸級核武器|南針 南針|博學多才 博學多才|卯酉參辰 卯酉參辰|印核 印核|卵核 卵核|原子核 原子核|原核 原核|去核 去核|參予 參予|參事 參事|參伍 參伍|參佐 參佐|參假 參假|參兩院 參兩院|參前落後 參前落後|參加 參加|參加人 參加人|參加國 參加國|參加完 參加完|參加爲 參加爲|參加獎 參加獎|參加者 參加者|參劾 參劾|參半 參半|參合 參合|參同契 參同契|參商 參商|參團 參團|參堂 參堂|參場 參場|參天 參天|參奏 參奏|參孫 參孫|參宿 參宿|參宿七 參宿七|參將 參將|參展 參展|參展商 參展商|參展團 參展團|參差 參差|參差不齊 參差不齊|參差錯落 參差錯落|參度 參度|參悟 參悟|參戰 參戰|參戰國 參戰國|參拜 參拜|參拾壹 參拾壹|參拾陸 參拾陸|參政 參政|參政權 參政權|參數 參數|參數表 參數表|參會 參會|參朝 參朝|參本 參本|參校 參校|參演 參演|參照 參照|參照卡 參照卡|參照物 參照物|參照系 參照系|參看 參看|參知政事 參知政事|參破 參破|參禪 參禪|參綜 參綜|參考 參考|參考值 參考值|參考價 參考價|參考價值 參考價值|參考參考 參考參考|參考座標 參考座標|參考性 參考性|參考手冊 參考手冊|參考文獻 參考文獻|參考書 參考書|參考書目 參考書目|參考材料 參考材料|參考法 參考法|參考消息 參考消息|參考特藏 參考特藏|參考系 參考系|參考資料 參考資料|參股 參股|參與 參與|參與人員 參與人員|參與制 參與制|參與度 參與度|參與感 參與感|參與權 參與權|參與率 參與率|參與者 參與者|參衆兩院 參衆兩院|參見 參見|參見互照 參見互照|參見注 參見注|參觀 參觀|參觀券 參觀券|參觀參觀 參觀參觀|參觀團 參觀團|參觀團體 參觀團體|參觀完 參觀完|參觀者 參觀者|參訂 參訂|參訓 參訓|參訪 參訪|參訪團 參訪團|參評 參評|參話頭 參話頭|參請 參請|參謀 參謀|參謀總部 參謀總部|參謀總長 參謀總長|參謀長 參謀長|參謁 參謁|參譚 參譚|參議 參議|參議員 參議員|參議會 參議會|參議院 參議院|參賽 參賽|參賽國 參賽國|參賽權 參賽權|參賽片 參賽片|參賽者 參賽者|參贊 參贊|參軍 參軍|參辰 參辰|參辰卯酉 參辰卯酉|參辰日月 參辰日月|參透 參透|參道 參道|參選 參選|參選人 參選人|參酌 參酌|參量 參量|參量空間 參量空間|參錯 參錯|參閱 參閱|參院 參院|參雜 參雜|參靈 參靈|參革 參革|參預 參預|參頭 參頭|參驗 參驗|反時針 反時針|反核 反核|取才 取才|口吃 口吃|口才 口才|口才好 口才好|口才辨給 口才辨給|可供參考 可供參考|可憎才 可憎才|吃口 喫口|吃口令 吃口令|吃口飯 喫口飯|吃吃 喫喫|吃子 喫子|合著 合著|合著者 合著者|同參 同參|名著 名著|向風針 向風針|命世之才 命世之才|命世才 命世才|和核 和核|唐才常 唐才常|唱針 唱針|啄針兒 啄針兒|善才 善才|善才童子 善才童子|喜憂參半 喜憂參半|喝參 喝參|喫敲才 喫敲才|喬才 喬才|單核 單核|單核細胞增多症 單核細胞增多症|嗎啡針 嗎啡針|四才子 四才子|四核 四核|圈梁 圈樑|國家棟梁 國家棟樑|土參 土參|在橋梁工地上 在橋樑工地上|地核 地核|地面核爆炸 地面核爆炸|埋沒人才 埋沒人才|增量參數 增量參數|外才 外才|外核 外核|多么 多麼|多事逞才 多事逞才|多才 多才|多才多藝 多才多藝|多核 多核|大廈棟梁 大廈棟樑|大才 大才|大才小用 大才小用|大才槃槃 大才槃槃|大政方針 大政方針|大曆十才子 大曆十才子|大核 大核|大梁 大梁|大海撈針 大海撈針|大頭針 大頭針|天妒英才 天妒英才|天才 天才|天才兒童 天才兒童|天才出自勤奮 天才出自勤奮|天才型 天才型|天才教育 天才教育|天才橫溢 天才橫溢|天才論 天才論|天縱之才 天縱之才|太乙神針 太乙神針|奇才 奇才|奇才異能 奇才異能|女人心海底針 女人心海底針|女子參政主義 女子參政主義|女子參政權 女子參政權|女秀才 女秀才|女貌郎才 女貌郎才|奴才 奴才|好么 好麼|妙才 妙才|學優才贍 學優才贍|學淺才疏 學淺才疏|學疏才淺 學疏才淺|宏內核 宏內核|定南針 定南針|定風針 定風針|實才 實才|將才 將才|將遇良才 將遇良才|專才 專才|專業人才 專業人才|專門人才 專門人才|對針 對針|小丑跳梁 小丑跳樑|小才大用 小才大用|小才子 小才子|小秀才 小秀才|小秀才學堂 小秀才學堂|小醜跳梁 小醜跳樑|小針 小針|小針美容 小針美容|少年才俊 少年才俊|尺二秀才 尺二秀才|屈才 屈才|屋梁 屋樑|展才 展才|山梁 山樑|岑參 岑參|巨著 巨著|帶團參加 帶團參加|常用參考書 常用參考書|平梁 平樑|平針縫 平針縫|幹才 幹才|幾針 幾針|庸才 庸才|廩膳秀才 廩膳秀才|引線穿針 引線穿針|張口 張口|張飛穿針 張飛穿針|強心針 強心針|弼針 弼針|彈針 彈針|彗核 彗核|形名參同 形名參同|待著 待着|得失參半 得失參半|微核 微核|徵才 徵才|德才 德才|德才兼備 德才兼備|德薄才疏 德薄才疏|志大才疏 志大才疏|志大才短 志大才短|志廣才疏 志廣才疏|怎么 怎麼|恃才傲物 恃才傲物|恃才矜己 恃才矜己|恃才自專 恃才自專|惡名昭著 惡名昭著|意廣才疏 意廣才疏|愛才 愛才|愛才好士 愛才好士|愛才如命 愛才如命|愛才若渴 愛才若渴|憂喜參半 憂喜參半|憐才 憐才|懷才不遇 懷才不遇|懷才抱德 懷才抱德|懸梁 懸樑|懸梁刺股 懸樑刺股|懸梁自盡 懸樑自盡|懸臂梁 懸臂樑|懸針 懸針|懸針垂露 懸針垂露|成兆才 成兆才|成核 成核|戰術核武器 戰術核武器|戳脊梁 戳脊樑|戳脊梁骨 戳脊樑骨|手腕式指北針 手腕式指北針|才人 才人|才俊 才俊|才儲八斗 才儲八斗|才具 才具|才兼文武 才兼文武|才分 才分|才力 才力|才勇兼優 才勇兼優|才名 才名|才器 才器|才士 才士|才大難用 才大難用|才女 才女|才如史遷 才如史遷|才媛 才媛|才子 才子|才子佳人 才子佳人|才子書 才子書|才學 才學|才學兼優 才學兼優|才守 才守|才定 才定|才幹 才幹|才廣妨身 才廣妨身|才微智淺 才微智淺|才德 才德|才德兼備 才德兼備|才思 才思|才思敏捷 才思敏捷|才悟 才悟|才情 才情|才智 才智|才望 才望|才氣 才氣|才氣無雙 才氣無雙|才氣縱橫 才氣縱橫|才氣過人 才氣過人|才爲世出 才爲世出|才用 才用|才略 才略|才略過人 才略過人|才當曹斗 才當曹斗|才疏學淺 才疏學淺|才疏德薄 才疏德薄|才疏志大 才疏志大|才疏意廣 才疏意廣|才疏計拙 才疏計拙|才短氣粗 才短氣粗|才秀人微 才秀人微|才能 才能|才能幹濟 才能幹濟|才色 才色|才華 才華|才華出衆 才華出衆|才華橫溢 才華橫溢|才華洋溢 才華洋溢|才華蓋世 才華蓋世|才蔽識淺 才蔽識淺|才藝 才藝|才藝卓絕 才藝卓絕|才藝技能 才藝技能|才藝班 才藝班|才藝秀 才藝秀|才藻 才藻|才語 才語|才識 才識|才識過人 才識過人|才貌 才貌|才貌出衆 才貌出衆|才貌雙全 才貌雙全|才貫二酉 才貫二酉|才資 才資|才輕德薄 才輕德薄|才過子建 才過子建|才過屈宋 才過屈宋|才非玉潤 才非玉潤|才高八斗 才高八斗|才高意廣 才高意廣|才高氣傲 才高氣傲|才高行厚 才高行厚|才高行潔 才高行潔|扎針 扎針|打參 打參|打完針 打完針|打針 打針|扛大梁 扛大樑|披針形葉 披針形葉|抵針 抵針|拈針指 拈針指|拔地參天 拔地參天|指北針 指北針|指南針 指南針|指針 指針|指針式 指針式|挑大梁 挑大樑|挑正梁 挑正樑|捫參歷井 捫參歷井|捷才 捷才|掃眉才子 掃眉才子|探針 探針|提梁 提樑|插針 插針|揚己露才 揚己露才|搖針 搖針|搗針 搗針|撞針 撞針|撥亂之才 撥亂之才|撫梁易柱 撫樑易柱|擬核 擬核|擺針 擺針|收針 收針|放參 放參|教育方針 教育方針|敹一針 敹一針|文才 文才|文武全才 文武全才|文選爛秀才半 文選爛秀才半|斗筲之才 斗筲之才|斗轉參橫 斗轉參橫|方針 方針|日月參辰 日月參辰|早參 早參|昭著 昭著|時針 時針|晚參 晚參|晨參暮省 晨參暮省|晨參暮禮 晨參暮禮|晶核 晶核|暈針 暈針|暮禮晨參 暮禮晨參|曠世之才 曠世之才|曠世奇才 曠世奇才|曠世逸才 曠世逸才|曲別針 曲別針|曹參 曹參|曾參 曾參|曾參殺人 曾參殺人|月核 月核|月落參橫 月落參橫|有才 有才|有才幹 有才幹|有才無命 有才無命|有核 有核|朝參暮禮 朝參暮禮|朝核 朝核|木梁 木樑|未易才 未易才|朽木之才 朽木之才|杏核 杏核|東海撈針 東海撈針|松針 松針|板梁橋 板樑橋|林木參天 林木參天|果核 果核|枝針 枝針|架梁 架樑|架海金梁 架海金樑|柱梁 柱樑|核下 核下|核二廠 核二廠|核人 核人|核仁 核仁|核以 核以|核僵持 核僵持|核兒 核兒|核冬天 核冬天|核出口控制 核出口控制|核力 核力|核化 核化|核區 核區|核可 核可|核合成 核合成|核和 核和|核四 核四|核型 核型|核子 核子|核子廠 核子廠|核孔 核孔|核島 核島|核工 核工|核彈 核彈|核心 核心|核戰 核戰|核戰鬥部 核戰鬥部|核技術 核技術|核數 核數|核是 核是|核有 核有|核果 核果|核桃 核桃|核武 核武|核火箭發動機 核火箭發動機|核炫 核炫|核燃料後處理 核燃料後處理|核爆 核爆|核爆炸煙雲 核爆炸煙雲|核狀 核狀|核球 核球|核甘 核甘|核當量 核當量|核發 核發|核發電 核發電|核發電廠 核發電廠|核的 核的|核磁 核磁|核種 核種|核突 核突|核粒 核粒|核糖 核糖|核糖核酸 核糖核酸|核素 核素|核線 核線|核能 核能|核能技術 核能技術|核能發電 核能發電|核能發電廠 核能發電廠|核能電廠 核能電廠|核膜 核膜|核苷 核苷|核菌 核菌|核融合 核融合|核融合發電 核融合發電|核解 核解|核計劃 核計劃|核試 核試|核談 核談|核質 核質|核載 核載|核辦 核辦|核配 核配|核酪 核酪|核酶 核酶|核酸 核酸|核防禦 核防禦|核電 核電|核電廠 核電廠|核電磁脈衝 核電磁脈衝|核體 核體|核點 核點|桃核 桃核|桃核雕 桃核雕|桑針 桑針|梁上 樑上|梁上君子 樑上君子|梁子 樑子|梁木 梁木|梁木其壞 樑木其壞|梁架 樑架|梁柱 樑柱|梁棟 樑棟|梁龍 梁龍|梅核 梅核|棄核 棄核|棋逢對手將遇良才 棋逢對手將遇良才|棒針 棒針|棒針衫 棒針衫|棗核 棗核|棘針 棘針|棘針科 棘針科|棘針門 棘針門|棟梁 棟樑|棟梁之任 棟樑之任|棟梁之材 棟樑之材|棟梁之臣 棟樑之臣|椽梁 椽樑|極核 極核|槃才 槃才|槃槃大才 槃槃大才|樹梁 樹樑|橋梁 橋樑|橋梁工事 橋樑工事|橋梁工程 橋樑工程|橘核 橘核|橫打鼻梁兒 橫打鼻樑兒|橫梁 橫樑|檢核 檢核|檢核表 檢核表|歌聲繞梁 歌聲繞樑|正則參數 正則參數|正梁 正樑|步線行針 步線行針|歪才 歪才|歷練之才 歷練之才|殺才 殺才|毒針 毒針|比才 比才|毛線針 毛線針|毫針 毫針|氘核 氘核|水底撈針 水底撈針|求才 求才|求才若渴 求才若渴|江南四大才子 江南四大才子|江參 江參|江淹才盡 江淹才盡|江郎才盡 江郎才盡|沒梁桶 沒樑桶|沒脊梁 沒脊樑|河梁 河樑|沿才授職 沿才授職|注射針 注射針|注射針頭 注射針頭|泰山梁木 泰山樑木|洗面皂 洗面皂|洗髮皂 洗髮皂|洛陽才子 洛陽才子|津梁 津樑|派團參加 派團參加|海參威 海參威|海參崴 海參崴|海底撈針 海底撈針|滿腹才學 滿腹才學|漁梁 漁樑|漏針 漏針|潑才 潑才|澤梁 澤樑|濟世之才 濟世之才|濠梁 濠樑|無核 無核|無梁 無樑|無梁斗 無樑斗|無梁樓蓋 無樑樓蓋|無針不引線 無針不引線|無針注射器 無針注射器|煤核 煤核|熔核 熔核|熱核 熱核|燔針 燔針|片善小才 片善小才|物色人才 物色人才|特殊才能 特殊才能|狀態參數 狀態參數|狗才 狗才|獨挑大梁 獨挑大樑|率團參加 率團參加|玉參差 玉參差|玉尺量才 玉尺量才|王佐之才 王佐之才|玳梁 玳樑|玳瑁梁 玳瑁樑|瑣才 瑣才|甄才品能 甄才品能|甄選人才 甄選人才|甚么 甚麼|男才女貌 男才女貌|畎畝下才 畎畝下才|留針 留針|略無參商 略無參商|畫梁雕棟 畫樑雕棟|畫棟雕梁 畫棟雕樑|異才 異才|當世才度 當世才度|疑信參半 疑信參半|疑核 疑核|痔核 痔核|痛失英才 痛失英才|登庸人才 登庸人才|發展核武器 發展核武器|白鶴梁 白鶴梁|白鶴秀才 白鶴秀才|百萬噸級核武器 百萬噸級核武器|百里之才 百里之才|皂化 皂化|皂莢 皂莢|皂莢樹 皂莢樹|皂角 皂角|的核 的核|直接參與 直接參與|真才實學 真才實學|真核 真核|矜才使氣 矜才使氣|矜能負才 矜能負才|短針 短針|石梁 石樑|石針 石針|硬核 硬核|硬肥皂 硬肥皂|碌碌庸才 碌碌庸才|磁核 磁核|磁針 磁針|磨杵成針 磨杵成針|磨脊梁 磨脊樑|磨針溪 磨針溪|磨鐵成針 磨鐵成針|社交才能 社交才能|禁核 禁核|秀才 秀才|秀才不出門能知天下事 秀才不出門能知天下事|秀才人情 秀才人情|秀才作醫如菜作虀 秀才作醫如菜作虀|秀才造反 秀才造反|秒針 秒針|秧針 秧針|穆稜 穆稜|積極參加 積極參加|積極參與 積極參與|空梁落燕泥 空樑落燕泥|穿針 穿針|穿針引線 穿針引線|穿針走線 穿針走線|筆參造化 筆參造化|管理人才 管理人才|箱梁 箱樑|精核 精核|約核 約核|約翰參書 約翰參書|紋光針 紋光針|細針密縷 細針密縷|結核 結核|結核桿菌 結核桿菌|結梁子 結樑子|絕對參照 絕對參照|絕才 絕才|絞包針 絞包針|給個棒錘當針認 給個棒錘當針認|綏稜 綏稜|經世之才 經世之才|經國之才 經國之才|經濟之才 經濟之才|網羅人才 網羅人才|綿裏藏針 綿裏藏針|綿裏針 綿裏針|縫衣針 縫衣針|縫針 縫針|縫針補線 縫針補線|縫針跡 縫針跡|縱梁 縱樑|總參謀部 總參謀部|總參謀長 總參謀長|總方針 總方針|繃針 繃針|繞梁 繞樑|繞梁三日 繞樑三日|繞梁之音 繞樑之音|繞梁韻永 繞樑韻永|繡花針 繡花針|繡花針兒 繡花針兒|繡針 繡針|羅盤針 羅盤針|美國參議院 美國參議院|美才 美才|美白針 美白針|老奴才 老奴才|耐多藥結核病 耐多藥結核病|耳針 耳針|聯合參謀 聯合參謀|聰明才智 聰明才智|肥皂 肥皂|肥皂劇 肥皂劇|肥皂泡 肥皂泡|肥皂粉 肥皂粉|肥皂絲 肥皂絲|肥皂莢 肥皂莢|育才 育才|胃口 胃口|背梁骨 背樑骨|胡才勇 胡才勇|胸針 胸針|脊梁 脊樑|脊梁背 脊樑背|脊梁骨 脊樑骨|自學成才 自學成才|自核 自核|船不漏針漏針沒外人 船不漏針漏針沒外人|花兒針 花兒針|花旗參 花旗參|英才 英才|英才俊偉 英才俊偉|茂才 茂才|茂才異等 茂才異等|茅針 茅針|茲核 茲核|菌核 菌核|菲才寡學 菲才寡學|落月屋梁 落月屋樑|葉針 葉針|著作 著作|著名 著名|著式 著式|著志 著志|著於 著於|著書 著書|著白 著白|著稱 著稱|著稱於世 著稱於世|著者 著者|著述 著述|著錄 著錄|蓋世之才 蓋世之才|藏針縫 藏針縫|藥皂 藥皂|藥針 藥針|蘋果核 蘋果核|蛇口蜂針 蛇口蜂針|螫針 螫針|蠹啄剖梁柱 蠹啄剖樑柱|蠻針瞎灸 蠻針瞎灸|行短才喬 行短才喬|行短才高 行短才高|補血針 補血針|補針 補針|製麵 製麪|西洋參 西洋參|要么 要麼|見縫插針 見縫插針|討針線 討針線|詠雪之才 詠雪之才|詩才 詩才|誇才賣智 誇才賣智|說參請 說參請|請參閱 請參閱|謊敲才 謊敲才|謝絕參觀 謝絕參觀|識多才廣 識多才廣|識才 識才|識才尊賢 識才尊賢|譭譽參半 譭譽參半|豎柱上梁 豎柱上樑|豎起脊梁 豎起脊樑|象牙針尖 象牙針尖|豬八戒喫人參果 豬八戒喫人參果|負才 負才|負才任氣 負才任氣|負才使氣 負才使氣|賀爾蒙針 賀爾蒙針|賢才 賢才|賤才 賤才|超世之才 超世之才|趫才 趫才|跳梁 跳樑|跳梁小丑 跳樑小丑|跳梁小醜 跳樑小醜|跳梁猖獗之小丑 跳樑猖獗之小丑|跳梁猖獗之小醜 跳樑猖獗之小醜|跳針 跳針|蹇吃 蹇吃|身才 身才|軟肥皂 軟肥皂|輇才 輇才|輕核 輕核|辯才 辯才|辯才天 辯才天|辯才無礙 辯才無礙|这么 这麼|迴紋針 迴紋針|退針 退針|逆時針 逆時針|這么 這麼|通人達才 通人達才|通才 通才|通才教育 通才教育|通才練識 通才練識|造就人才 造就人才|逸才 逸才|逸羣之才 逸羣之才|過人才略 過人才略|過梁 過樑|違紀參選 違紀參選|適才 適才|選才 選才|選民參加率 選民參加率|遺才 遺才|避雷針 避雷針|邊核 邊核|那么 那麼|郎才女姿 郎才女姿|郎才女貌 郎才女貌|鄧艾吃 鄧艾吃|野無遺才 野無遺才|量才錄用 量才錄用|金針 金針|金針山 金針山|金針度人 金針度人|金針花 金針花|金針菇 金針菇|金針菜 金針菜|釘書針 釘書針|針具 針具|針刺 針刺|針刺麻醉 針刺麻醉|針劑 針劑|針孔 針孔|針孔攝影機 針孔攝影機|針孔照像 針孔照像|針孔照像機 針孔照像機|針孔現象 針孔現象|針對 針對|針對性 針對性|針對於 針對於|針尖 針尖|針尖兒 針尖兒|針工 針工|針布 針布|針形葉 針形葉|針指 針指|針挑刀挖 針挑刀挖|針梳機 針梳機|針氈 針氈|針法 針法|針炙 針炙|針狀 針狀|針狀物 針狀物|針盤 針盤|針眼 針眼|針眼子 針眼子|針神 針神|針筆 針筆|針筆匠 針筆匠|針筒 針筒|針箍 針箍|針箍兒 針箍兒|針線 針線|針線包 針線包|針線娘 針線娘|針線活 針線活|針線活計 針線活計|針線盒 針線盒|針線箔籬 針線箔籬|針織 針織|針織品 針織品|針織廠 針織廠|針織料 針織料|針腳 針腳|針葉 針葉|針葉林 針葉林|針葉植物 針葉植物|針葉樹 針葉樹|針針見血 針針見血|針釦 針釦|針鋒 針鋒|針鋒相對 針鋒相對|針鋒相投 針鋒相投|針鋩 針鋩|針頭 針頭|針餌莫減 針餌莫減|針骨 針骨|針魚 針魚|針黹 針黹|針黹紡績 針黹紡績|針鼴 針鼴|針鼻 針鼻|針鼻兒 針鼻兒|釦針 釦針|鉅著 鉅著|鉤針 鉤針|銀核 銀核|銀針 銀針|鋼梁 鋼樑|鋼針 鋼針|錶針 錶針|鐵針 鐵針|鑑核備查 鑑核備查|鑿壁懸梁 鑿壁懸樑|長才 長才|長針 長針|開口 開口|防疫針 防疫針|陰核 陰核|隨才器使 隨才器使|雄才 雄才|雄才大略 雄才大略|雌核 雌核|雕梁 雕樑|雕梁畫柱 雕樑畫柱|雕梁畫棟 雕樑畫棟|雙核 雙核|雙鏈核酸 雙鏈核酸|電唱針 電唱針|電針 電針|電針麻醉 電針麻醉|需才孔亟 需才孔亟|露才 露才|露才揚己 露才揚己|霸才 霸才|非才 非才|非核 非核|面皂 面皂|頂核 頂核|頂梁柱 頂樑柱|頂梁骨走了真魂 頂樑骨走了真魂|頂針 頂針|頂針兒 頂針兒|頂針捱住 頂針捱住|頂門針 頂門針|順時針 順時針|預防針 預防針|領帶針 領帶針|頭懸梁錐刺股 頭懸樑錐刺股|顯著 顯著|顯著標志 顯著標志|風向針 風向針|風流才子 風流才子|飛梁 飛樑|飛針走線 飛針走線|飽學秀才 飽學秀才|餘音繞梁 餘音繞樑|餘響繞梁 餘響繞樑|香皂 香皂|馮驥才 馮驥才|驚才絕豔 驚才絕豔|骨針 骨針|高參 高參|高才 高才|高才生 高才生|高級管理人才 高級管理人才|髮針 髮針|鬼才 鬼才|鬼針草 鬼針草|魚梁 魚樑|魚頭參政 魚頭參政|鴻篇鉅著 鴻篇鉅著|鹽水針 鹽水針|麴秀才 麴秀才|麻醉針 麻醉針|黃有才 黃有才|點核 點核|鼻梁 鼻樑|鼻梁兒 鼻樑兒|鼻梁骨 鼻樑骨|鼻無梁柱 鼻無樑柱|鼻針療法 鼻針療法|齧蘗吞針 齧蘗吞針", h = "么 幺|偽 僞|參 蔘|吃 喫|唇 脣|啟 啓|媯 嬀|嫻 嫺|峰 峯|床 牀|才 纔|核 覈|汙 污|洩 泄|溈 潙|潀 潨|灶 竈|為 爲|痴 癡|痺 痹|皂 皁|眾 衆|睪 睾|秘 祕|稜 棱|簷 檐|粽 糉|缽 鉢|群 羣|著 着|蒍 蔿|裡 裏|踴 踊|針 鍼|韁 繮|顎 齶|鯰 鮎|麵 麪", p = "A型肝炎 甲型肝炎|A肝 甲肝|BMW集團 寶馬集團|B型肝炎 乙型肝炎|B肝 乙肝|C型肝炎 丙型肝炎|C肝 丙肝|D型肝炎 丁型肝炎|D肝 丁肝|E型肝炎 戊型肝炎|E肝 戊肝|PN接面 PN結|SQL隱碼攻擊 SQL注入|三極體 三極管|下拉式清單 下拉列表|丙胺酸 丙氨酸|丟擲 拋出|中介軟體 中間件|丹尼·鮑伊 丹尼·博伊爾|主機板 主板|主開機記錄 主引導記錄|乙太網 以太網|乙太網路 以太網|乙太網路由器 以太網路由器|乙太網路路由器 以太網路由器|乙醯胺酚 對乙酰氨基酚|乳酪 奶酪|二極體 二極管|互動 交互|互動式 交互式|亞塞拜然 阿塞拜疆|亮胺酸 亮氨酸|人工智慧 人工智能|介面 界面|介面卡 適配器|代碼 代碼|代謝症候群 代謝綜合徵|伊利諾 伊利諾伊|伊利諾州 伊利諾伊州|伊力·卡山 伊利亞·卡贊|伺服器 服務器|佇列 隊列|位元 比特|位元率 比特率|位元組 字節|位元速率 碼率|位址 地址|位址列 地址欄|低級 低級|低階 低級|佛漢·威廉斯 沃恩·威廉斯|佛瑞 福雷|作業系統 操作系統|使用者 用戶|使用者名稱 用戶名|來電轉接 呼叫轉移|例項 實例|保羅·海吉斯 保羅·哈吉斯|信號 信號|停用 禁用|偵錯 調試|偵錯程式 調試器|傅立葉 傅里葉|傳送 發送|傷心小棧 紅心大戰|價效比 性價比|優先順序 優先級|儲存 保存|元件 組件|光碟 光盤|光碟機 光驅|克林·伊斯威特 克林特·伊斯特伍德|克羅埃西亞 克羅地亞|克萊門第 克萊門蒂|克里斯多福·諾蘭 克里斯托弗·諾蘭|入口網站 門戶網站|內建 內置|內碼表 代碼頁|全域性 全局|全形 全角|全球資訊網 萬維網|公元紀年 公元紀年|冰棒 冰棍|冷盤 涼菜|凱吉 凱奇|凱文·科斯納 凱文·科斯特納|凱薩琳·畢格羅 凱瑟琳·畢格羅|函式 函數|函數語言程式設計 函數式編程|刀鋒伺服器 刀片服務器|分割槽 分區|分散式 分佈式|分時多工 時分複用|分時多重進接 時分多址|分碼多重進接 碼分多址|分空間多重進接 空分多址|分頻多工 頻分複用|分頻多重進接 頻分多址|列印 打印|列支敦斯登 列支敦士登|列舉 枚舉|利蓋悌 利蓋蒂|前處理器 預處理器|剪下 剪切|剪貼簿 剪貼板|副檔名 擴展名|加彭 加蓬|勞勃·懷斯 羅伯特·懷斯|勞勃·班頓 羅伯特·本頓|勞勃·瑞福 羅伯特·雷德福|包羅定 鮑羅丁|北卡羅萊納 北卡羅來納|北卡羅萊納州 北卡羅來納州|北馬利安納 北馬里亞納|北馬利安納群島 北馬里亞納羣島|匯入 導入|匯出 導出|匯流排 總線|區域性 局部|區域網 局域網|千里達及托巴哥 特立尼達和多巴哥|半形 半角|南卡羅萊納 南卡羅來納|南卡羅萊納州 南卡羅來納州|卡達 卡塔爾|印表機 打印機|即時 實時|厄利垂亞 厄立特里亞|厄瓜多 厄瓜多爾|原始檔 源文件|原始碼 源代碼|原生代碼 本地代碼|參數列 參數表|取樣 採樣|取樣率 採樣率|叢集 集羣|叮叮噹 丁丁當|叮叮噹噹 丁丁當當|叮噹 丁當|台積公司 臺積公司|台積電 臺積電|史他汀類 他汀類|史克里亞賓 斯克里亞賓|史卡拉第 斯卡拉蒂|史托克豪森 施托克豪森|史提夫·麥昆 史蒂夫·麥奎因|史特勞斯 施特勞斯|史特拉汶斯基 斯特拉文斯基|史瓦濟蘭 斯威士蘭|史蒂芬·史匹柏 斯蒂芬·斯皮爾伯格|史麥塔納 斯美塔那|司法程序 司法程序|吉勒摩·戴托羅 吉列爾莫·德爾托羅|吉布地 吉布堤|吉里巴斯 基里巴斯|名字空間 命名空間|名稱空間 命名空間|吐瓦魯 圖瓦盧|向量 矢量|呼叫 調用|命令列 命令行|咖哩 咖喱|哈薩克 哈薩克斯坦|哥斯大黎加 哥斯達黎加|唐氏症 唐氏綜合徵|啟用 激活|喬治·克隆尼 喬治·克魯尼|喬治亞 喬治亞|喬治亞共和國 格魯吉亞共和國|喬治亞州 佐治亞州|單核心 宏內核|回撥 回調|圖示 圖標|土庫曼 土庫曼斯坦|地址 地址|坦尚尼亞 坦桑尼亞|型別 類型|埠 端口|執行 運行|執行檔 可執行文件|執行緒 線程|執行長 首席執行官|堆疊 堆棧|場效電晶體 場效應管|塑膠 塑料|塔吉克 塔吉克斯坦|塞席爾 塞舌爾|塞普勒斯 塞浦路斯|壁紙 壁紙|夏農 香農|外掛 插件|外接 外置|外部索引鍵 外鍵|多囊性卵巢症候群 多囊卵巢綜合徵|多型 多態|多執行緒 多線程|多尼采第 多尼采蒂|多工 多任務|多明尼加 多米尼加|大數據 大數據|大腸激躁症 腸易激綜合徵|天冬胺酸 天冬氨酸|天冬醯胺 天冬酰胺|天門冬胺酸 天門冬氨酸|天門冬醯胺 天門冬酰胺|太空梭 航天飛機|失智症 癡呆症|奈及利亞 尼日利亞|奈米 納米|奧克拉荷馬 俄克拉何馬|奧克拉荷馬城 俄克拉何馬城|奧克拉荷馬州 俄克拉何馬州|奧克拉荷馬市 俄克拉何馬市|奧利佛·史東 奧利弗·斯通|奧勒岡 俄勒岡|奧勒岡州 俄勒岡州|奧福 奧爾夫|好市多 開市客|好市多公司 開市客公司|妥瑞氏症 抽動穢語綜合徵|妥瑞症 抽動穢語綜合徵|威廉·佛雷金 威廉·弗萊德金|威斯康辛 威斯康星|威斯康辛州 威斯康星州|嬌生公司 強生公司|子音 輔音|字串 字符串|字元 字符|字元集 字符集|字型 字體|字型檔 字庫|字尾 後綴|字節跳動 字節跳動|字首 前綴|存取 訪問|存檔 存盤|孟德爾頌 門德爾松|安地卡及巴布達 安提瓜和巴布達|安比西林 氨苄西林|安莫西林 阿莫西林|宏都拉斯 洪都拉斯|宕機 死機|定址 尋址|宣告 聲明|密西根 密歇根|密西根州 密歇根州|實例 實例|實體地址 物理地址|實體記憶體 物理內存|寬頻 寬帶|寮人民民主共和國 老撾人民民主共和國|寮國 老撾|寶僑 寶潔|寶僑公司 寶潔公司|專案 項目|對乙醯胺基酚 對乙酰氨基酚|對映 映射|對話方塊 對話框|對象 對象|尚比亞 贊比亞|尤拉 歐拉|尼日 尼日爾|巢狀 嵌套|工作列 任務欄|工作管理員 任務管理器|巨集 宏|巨集函式 宏函數|巨集呼叫 宏調用|巨集命令 宏命令|巨集定義 宏定義|巨集展開 宏展開|巨集指令 宏指令|巨集替換 宏替換|巨集程式設計 宏編程|巨集處理 宏處理|巨集語言 宏語言|巴布亞紐幾內亞 巴布亞新幾內亞|巴貝多 巴巴多斯|巴金森氏症 帕金森病|市場行銷 市場營銷|布列敦 布雷頓|布列敦森林 布雷頓森林|布列敦森林制度 布雷頓森林體系|布吉納法索 布基納法索|布拉姆斯 勃拉姆斯|布林 布爾|布瑞頓 布里頓|布萊德·彼特 布拉德·皮特|布萊茲 布列茲|帕金森氏症 帕金森病|帛琉 帕勞|平行計算 並行計算|幾內亞比索 幾內亞比紹|序列 串行|序列埠 串口|序號產生器 註冊機|庫欣氏症候群 庫欣綜合徵|康乃狄克 康涅狄格|康乃狄克州 康涅狄格州|建構函式 構造函數|建構子 構造器|建立 創建|引數 參數|彙編 彙編|彩色超音波 彩超|影像 圖像|影印 複印|影片 視頻|彼得·傑克森 彼得·傑克遜|後天免疫缺乏症候群 獲得性免疫缺陷綜合徵|後設資料 元數據|循環 循環|微控制器 單片機|德布西 德彪西|德弗札克 德沃夏克|德拉瓦 特拉華|德拉瓦州 特拉華州|心室顫動 心室顫動|心房撲動 心房撲動|心房顫動 心房顫動|心肌梗塞 心肌梗死|快取 緩存|快取記憶體 高速緩存|快捷半導體 仙童半導體|快閃記憶體 閃存|急性呼吸窘迫症候群 急性呼吸窘迫綜合徵|愛滋病 艾滋病|愛滋病患 艾滋病人|愛滋病毒 艾滋病毒|愛荷華 艾奧瓦|愛荷華州 艾奧瓦州|愛黛兒·羅曼斯基 阿黛爾·羅曼斯基|感測 傳感|慢性疲勞症候群 慢性疲勞綜合徵|憂鬱症 抑鬱症|戒斷症候群 戒斷綜合徵|截圖 截屏|戴奧辛 二噁英|戴流士 戴留斯|打開 打開|批次 批量|技術長 首席技術官|拉摩 拉莫|拉羅 拉洛|拉赫曼尼諾夫 拉赫瑪尼諾夫|指令式程式設計 命令式編程|指令碼 腳本|指標 指針|捲軸 滾動條|掃描器 掃描儀|排程 調度|控制代碼 句柄|控制元件 控件|提佩特 蒂佩特|搜尋 搜索|摩爾線程 摩爾線程|摺積 捲積|撥出 呼出|擴充套件 擴展|擴音 免提|擷取 截取|攜帶型 便攜式|攝護腺 前列腺|支持者 支持者|支援 支持|效能 性能|整合 集成|數位 數字|數位人文 數字人文|數位印刷 數字印刷|數位電子 數字電子|數位電路 數字電路|數字 數字|數據 數據|數據機 調製解調器|文件 文檔|文書處理 文字處理|斯洛維尼亞 斯洛文尼亞|新增 添加|新罕布夏 新罕布什爾|新罕布夏州 新罕布什爾州|方程式 方程式|映象 鏡像|映象管 顯像管|時脈頻率 時鐘頻率|普羅高菲夫 普羅科菲耶夫|普賽爾 珀塞爾|晶片 芯片|智慧 智能|智慧財產權 知識產權|暫存器 寄存器|最佳化 優化|有失真壓縮 有損壓縮|朗·霍華 朗·霍華德|林姆斯基-高沙可夫 里姆斯基-科薩科夫|查德 乍得|查詢 查找|柯恩兄弟 科恩兄弟|柯普蘭 科普蘭|柯雷利 科雷利|核取按鈕 複選按鈕|核取方塊 複選框|核心 內核|格瑞那達 格林納達|桌上型 桌面型|桌上型電腦 臺式機|桌布 壁紙|梅湘 梅西安|梅爾·吉勃遜 梅爾·吉布森|楊納傑克 雅納切克|榴槤 榴蓮|標頭檔案 頭文件|模擬 模擬|模組 模塊|模里西斯 毛里求斯|機率 概率|檔名 文件名|檔案 文件|檢視 查看|欄位 字段|歐巴馬 奧巴馬|正子 正電子|正子斷層造影 正電子發射計算機斷層|正當程序 正當程序|正規化 範式|正規表示式 正則表達式|母音 元音|比特幣 比特幣|氣泡排序 冒泡排序|永珍 萬象|永續性 持久性|汶萊 文萊|沙烏地阿拉伯 沙特阿拉伯|沙烏地阿美 沙特阿美|沙烏地阿美公司 沙特阿美公司|法蘭西絲·麥朵曼 弗朗西絲·麥克多曼德|泡麵 方便麪|波克夏海瑟威 伯克希爾哈撒韋|波克夏海瑟威公司 伯克希爾哈撒韋公司|波凱里尼 博凱里尼|波士尼亞赫塞哥維納 波斯尼亞黑塞哥維那|波札那 博茨瓦納|波長分波多工 波分複用|海內存知己 海內存知己|海飛茲 海菲茨|消息 消息|游標 光標|溢位 溢出|滑鼠 鼠標|演算法 算法|漢他病毒 漢坦病毒|潘德列茲基 潘德列茨基|烏茲別克 烏茲別克斯坦|無失真壓縮 無損壓縮|燒錄 刻錄|營運長 首席運營官|片語 詞組|物件 對象|物件導向 面向對象|狀態列 狀態欄|獅子山 塞拉利昂|珍·康萍 簡·坎皮恩|班·艾佛列克 本·阿弗萊克|瓜地馬拉 危地馬拉|甘比亞 岡比亞|甘胺酸 甘氨酸|甲硫胺酸 甲硫氨酸|畫素 像素|異亮胺酸 異亮氨酸|異白胺酸 異亮氨酸|登入 登錄|登出 註銷|登錄檔 註冊表|白胺酸 亮氨酸|白血球 白細胞|白遼士 柏遼茲|盧安達 盧旺達|目的碼 目標代碼|直譯器 解釋器|相容 兼容|相簿 相冊|真實模式 實模式|睡眠呼吸中止症 睡眠呼吸暫停綜合徵|矽 硅|砈 砹|破圖 花屏|硬碟 硬盤|硬體 硬件|碟片 盤片|磁碟 磁盤|磁碟機代號 盤符|磁軌 磁道|社區 社區|社群 社區|福斯汽車 大衆汽車|福斯汽車集團 大衆汽車集團|福斯集團 大衆集團|程序 進程|程序不正義 程序不正義|程序導向 面向過程|程序式程式設計 過程式編程|程序正義 程序正義|程式 程序|程式碼 代碼|程式設計 編程|程式設計師 程序員|程式語言 編程語言|稽核 審覈|穀氨醯胺 穀氨酰胺|穀胺酸 穀氨酸|穆索斯基 穆索爾斯基|積體電路 集成電路|空氣清淨機 空氣淨化器|空間多工 空分複用|突尼西亞 突尼斯|筆記型電腦 筆記本電腦|範式 範式|簡報 演示文稿|簡訊 短信|簽帳金融卡 借記卡|米歇爾·哈札納維西斯 米歇爾·阿扎納維西於斯|粘貼 粘貼|精胺酸 精氨酸|約瑟夫·孟威茲 約瑟夫·曼凱維奇|紅血球 紅細胞|納米比亞 納米比亞|紐澤西 新澤西|紐澤西州 新澤西州|紐西蘭 新西蘭|索羅門群島 所羅門羣島|索馬利亞 索馬里|終端使用者 最終用戶|組合語言 彙編語言|組胺酸 組氨酸|組譯 彙編|組譯器 彙編器|結束通話 掛斷|絲胺酸 絲氨酸|綁架丁丁當 綁架丁丁當|經前症候群 經前期綜合徵|維吉尼亞 弗吉尼亞|維吉尼亞州 弗吉尼亞州|維德角 佛得角|網咖 網吧|網絡卡 網卡|網路 網絡|網路上的芳鄰 網上鄰居|網際網路 互聯網|線上 在線|縮圖 縮略圖|縮排 縮進|繫結 綁定|纈胺酸 纈氨酸|羅勃·辛密克斯 羅伯特·澤米吉斯|羅德島 羅得島|羅德島州 羅得島州|美屬維京群島 美屬維爾京羣島|義大利 意大利|老年失智症 老年癡呆症|聖克里斯多福及尼維斯 聖基茨和尼維斯|聖文森及格瑞那丁 聖文森特和格林納丁斯|聖露西亞 聖盧西亞|聖馬利諾 聖馬力諾|聯結器 連接器|聯絡 聯繫|肯亞 肯尼亞|胰臟 胰腺|胱胺酸 胱氨酸|胺基酸 氨基酸|脯胺酸 脯氨酸|腎病症候群 腎病綜合徵|腕隧道症候群 腕管綜合徵|腦梗塞 腦梗死|腳踏車 自行車|自動旋轉螢幕 自動轉屏|自閉症 孤獨症|興德密特 欣德米特|色胺酸 色氨酸|艾克森美孚 埃克森美孚|艾爾加 埃爾加|艾瑪·湯瑪斯 艾瑪·托馬斯|苯丙胺酸 苯丙氨酸|茅利塔尼亞 毛里塔尼亞|荀白克 勳伯格|莫三比克 莫桑比克|莫札特 莫扎特|菜單 菜單|華倫·比提 沃倫·比蒂|華格納 瓦格納|華爾頓 沃爾頓|萊許 賴希|萊雅 歐萊雅|萊雅集團 歐萊雅集團|萬用字元 通配符|萬那杜 瓦努阿圖|葉門 也門|葛令卡 格林卡|葛利格 格里格|葛拉斯 格拉斯|葛摩 科摩羅|蒲隆地 布隆迪|蓋亞那 圭亞那|蓋希文 格什溫|蕭士塔高維契 肖斯塔科維奇|蕭邦 肖邦|薛尼·波拉克 西德尼·波拉克|薩拉沙泰 薩拉薩蒂|薩提 薩蒂|藍色畫面 藍屏|蘇利南 蘇里南|蘇胺酸 蘇氨酸|處理程序 處理程序|虛擬函式 虛函數|虛擬機器 虛擬機|虛擬碼 僞代碼|螢幕 屏幕|血紅素 血紅蛋白|行內函數 內聯函數|行動式 便攜式|行動數據 移動數據|行動硬碟 移動硬盤|行動網路 移動網絡|行動通訊 移動通信|行動電話 移動電話|行程 進程|衣索比亞 埃塞俄比亞|表示式 表達式|裝置 設備|複製 拷貝|西元 公元|西恩·貝克 肖恩·貝克|西維吉尼亞 西弗吉尼亞|西維吉尼亞州 西弗吉尼亞州|西貝流士 西貝柳斯|視窗 窗口|視覺化 可視化|視訊 視頻|視訊會議 視頻會議|視訊記憶體 顯存|視訊通話 視頻通話|解析度 分辨率|解構函式 析構函數|解構子 析構函數|解除安裝 卸載|觸控 觸摸|觸控式螢幕 觸摸屏|計程車 出租車|訊息 消息|訊號 信號|訊雜比 信噪比|記憶體 內存|記憶體模組 內存條|訪問 訪問|設定 設置|許可權 權限|訴訟程序 訴訟程序|詹姆斯·卡麥隆 詹姆斯·卡梅隆|調色盤 調色盤|調變 調製|諾蘭 諾蘭|諾魯 瑙魯|識別符號 標識符|變數 變量|象牙海岸 科特迪瓦|貝南 貝寧|貝里尼 貝利尼|貝里斯 伯利茲|貼上 粘貼|資料 數據|資料來源 數據源|資料倉儲 數據倉庫|資料包 數據報|資料夾 文件夾|資料庫 數據庫|資料探勘 數據挖掘|資訊 信息|資訊安全 信息安全|資訊理論 信息論|資訊科技 信息技術|資訊長 首席信息官|賓士 奔馳|賴比瑞亞 利比里亞|賴索托 萊索托|超程式設計 元編程|超音波 超聲波|跳脫字元 轉義字符|軟碟機 軟驅|軟體 軟件|軟體動物 軟體動物|載入 加載|載入程式 引導程序|輝達 英偉達|辛巴威 津巴布韋|迦納 加納|迴圈 循環|通訊 通信|通話卡 通訊卡|通話記錄 聯繫歷史|通道 通道|速食麵 方便麪|連結 鏈接|連結串列 鏈表|連線 連接|進位制 進制|進程 進程|進階 高級|進階設定 高級設置|進階選項 高級選項|運算元 操作數|運算子 操作符|運算式 表達式|過動症 多動症|過載 重載|遞迴 遞歸|遠端 遠程|遮蔽 屏蔽|選單 菜單|邏輯閘 邏輯門|那杜 溫納圖萬|部落格 博客|都會網路 城域網|酪胺酸 酪氨酸|醯 酰|釋出 發佈|重新命名 重命名|重新整理 刷新|重灌 重裝|金氧半導體 金屬氧化物半導體|金鑰 密鑰|鈽 鈈|鉲 鐦|鉳 錇|鋂 鎇|錄影 錄像|錼 鎿|鍅 鈁|鎝 鍀|鎦 鑥|鑀 鎄|開啟 打開|閘流體 晶閘管|閘道器 網關|閘電路 門電路|關聯式資料庫 關係數據庫|防寫 寫保護|防毒 殺毒|阻斷劑 阻滯劑|阿利安卓·崗札雷·伊納利圖 亞歷杭德羅·岡薩雷斯·伊納裏圖|阿拉伯聯合大公國 阿拉伯聯合酋長國|阿斯匹靈 阿司匹林|阿斯特捷利康 阿斯利康|阿斯特捷利康公司 阿斯利康公司|阿茲海默氏症 阿爾茨海默氏症|阿茲海默症 阿爾茨海默症|阿莫西林 阿莫西林|陣列 數組|除錯 調試|隨身碟 U盤|雜湊 哈希|離線 脫機|離胺酸 賴氨酸|雲端儲存 雲存儲|雲端計算 雲計算|雷射 激光|雷諾氏症候群 雷諾綜合徵|電晶體 晶體管|電腦保安 計算機安全|電腦斷層 計算機斷層|電腦科學 計算機科學|霍洛維茲 霍洛維茨|非同步 異步|韋本 韋伯恩|韋瓦第 維瓦爾第|韌體 固件|韓德爾 亨德爾|音效卡 聲卡|音訊 音頻|頁尾 頁腳|頁首 頁眉|預設 預設|預設值 默認值|頻寬 帶寬|類别範本 類模板|類比 模擬|類比電子 模擬電子|類比電路 模擬電路|顧爾德 古爾德|顯示卡 顯卡|飛航模式 飛行模式|馬丁·史柯西斯 馬丁·斯科塞斯|馬凡氏症 馬方綜合徵|馬凡氏症候群 馬方綜合徵|馬利共和國 馬里共和國|馬爾地夫 馬爾代夫|駭客 黑客|高效能運算 高性能計算|高畫質 高清|高空彈跳 蹦極|高級 高級|高階 高級|麥克·尼可斯 邁克·尼科爾斯|麥克·道格拉斯 邁克爾·道格拉斯|麩胺酸 穀氨酸|麩醯胺酸 穀氨酰胺|麻薩諸塞 馬薩諸塞|麻薩諸塞州 馬薩諸塞州|黃體素 孕酮|點選 點擊|點陣圖 位圖", y = "一坏 一坯|一目瞭然 一目了然|七逕 七迳|上逕 上迳|上鍊 上链|不可貲計 不可赀計|不瞭解 不了解|么麼 幺麽|么麽 幺麽|九逕山 九迳山|乾乾淨淨 干干净净|乾乾脆脆 干干脆脆|乾佑縣 乾佑县|乾元 乾元|乾卦 乾卦|乾嘉 乾嘉|乾圖 乾图|乾坤 乾坤|乾坤一擲 乾坤一掷|乾坤再造 乾坤再造|乾坤大挪移 乾坤大挪移|乾宅 乾宅|乾安縣 乾安县|乾安鎮 乾安镇|乾州 乾州|乾斷 乾断|乾斷食 干断食|乾旦 乾旦|乾曜 乾曜|乾清宮 乾清宫|乾盛世 乾盛世|乾紅 干红|乾綱 乾纲|乾縣 乾县|乾象 乾象|乾造 乾造|乾道 乾道|乾闥婆 乾闼婆|乾陵 乾陵|乾隆 乾隆|乾隆年間 乾隆年间|乾隆皇帝 乾隆皇帝|二噁英 二𫫇英|仇讎 仇雠|以免藉口 以免借口|以功覆過 以功覆过|任筆沈詩 任笔沈诗|侔德覆載 侔德覆载|傢俱 家具|傷亡枕藉 伤亡枕藉|允祕 允祕|八濛山 八濛山|其陰多蒐 其阴多蒐|凌藉 凌借|出醜狼藉 出丑狼藉|函覆 函复|剋架 剋架|剋毒 剋毒|千鍾粟 千锺粟|南氾 南氾|南逕 南迳|反反覆覆 反反复复|反覆 反复|反覆思維 反复思维|反覆思量 反复思量|反覆性 反复性|名覆金甌 名复金瓯|吳祕 吴祕|吳育昇 吴育昇|哪吒 哪吒|回覆 回复|土坏 土坯|坏土 坯土|坏子 坯子|坏布 坯布|坏戶 坯户|墨沈沈 墨沉沉|壺裏乾坤 壶里乾坤|大目乾連冥間救母變文 大目乾连冥间救母变文|宫商角徵羽 宫商角徵羽|射覆 射覆|尼乾子 尼乾子|尼乾陀 尼乾陀|年釐 年釐|幺麼 幺麽|幺麼小丑 幺麽小丑|幺麼小醜 幺麽小丑|康乾 康乾|張昇 张昇|張法乾 张法乾|彷彿 仿佛|彷徨 彷徨|徐胤昇 徐胤昇|復甦 复苏|徵弦 徵弦|徵絃 徵弦|徵羽摩柯 徵羽摩柯|徵聲 徵声|徵調 徵调|徵音 徵音|情有獨鍾 情有独钟|想像 想像|意志消沈 意志消沉|慰藉 慰藉|慰藉着 慰藉着|憑藉 凭借|憑藉着 凭借着|懷釐 怀釐|成甦 成甦|所費不貲 所费不赀|手鍊 手链|打坏 打坯|扞格 扞格|扭轉乾坤 扭转乾坤|批覆 批复|找藉口 找借口|折戟沈沙 折戟沉沙|折戟沈河 折戟沉河|拉坏 拉坯|拉鍊 拉链|拉鍊工程 拉链工程|拜覆 拜复|挨剋 挨剋|捏坏 捏坯|擊沈 击沉|據瞭解 据了解|文錦覆阱 文锦覆阱|於世成 於世成|於乎 於乎|於仲完 於仲完|於倫 於伦|於其一 於其一|於則 於则|於勇明 於勇明|於呼哀哉 於呼哀哉|於單 於单|於坦 於坦|於崇文 於崇文|於忠祥 於忠祥|於惟一 於惟一|於戲 於戏|於敖 於敖|於梨華 於梨华|於清言 於清言|於潛 於潜|於琳 於琳|於穆 於穆|於竹屋 於竹屋|於菟 於菟|於邑 於邑|於陵子 於陵子|旋乾轉坤 旋乾转坤|旋轉乾坤 旋转乾坤|旋轉乾坤之力 旋转乾坤之力|明瞭 明了|明覆 明复|昏沈 昏沉|春蒐 春蒐|春釐 春釐|暗沈沈 暗沉沉|書中自有千鍾粟 书中自有千锺粟|有序 有序|朝乾夕惕 朝乾夕惕|木吒 木吒|李乾德 李乾德|李昇 李昇|李昇勳 李昇勋|李澤鉅 李泽钜|李祕 李祕|李鍊福 李链福|李鍾郁 李锺郁|束脩 束脩|東氾 东氾|林甦 林甦|校讎 校雠|梁昇卿 梁昇卿|梁章鉅 梁章钜|楊甦棣 杨甦棣|楊聯陞 杨联陞|樊於期 樊於期|橡椀 橡椀|死氣沈沈 死气沉沉|段脩 段脩|毛坏 毛坯|水逕 水迳|氾勝之 氾胜之|氾南 氾南|氾國 氾国|氾水 氾水|沈下 沉下|沈不住氣 沉不住气|沈住氣 沉住气|沈冤 沉冤|沈厚 沉厚|沈吟 沉吟|沈寂 沉寂|沈得住氣 沉得住气|沈思 沉思|沈思往事 沉思往事|沈悶 沉闷|沈沒 沉没|沈沒成本 沉没成本|沈浮 沉浮|沈浸 沉浸|沈浸於 沉浸于|沈淪 沉沦|沈湎 沉湎|沈湎酒色 沉湎酒色|沈溺 沉溺|沈滯 沉滞|沈滯性 沉滞性|沈澱 沉淀|沈澱出來 沉淀出来|沈澱劑 沉淀剂|沈澱法 沉淀法|沈澱物 沉淀物|沈濁 沉浊|沈甸甸 沉甸甸|沈痛 沉痛|沈痼 沉痼|沈痾 沉疴|沈睡 沉睡|沈睡不醒 沉睡不醒|沈砂池 沉砂池|沈積 沉积|沈積岩 沉积岩|沈積石 沉积石|沈筒 沉筒|沈船 沉船|沈落 沉落|沈詩任筆 沈诗任笔|沈迷 沉迷|沈迷不醒 沉迷不醒|沈醉 沉醉|沈重 沉重|沈降 沉降|沈陷 沉陷|沈靜 沉静|沈靜下來 沉静下来|沈香 沉香|沈鬱 沉郁|沈魚落雁 沉鱼落雁|沈默 沉默|沈默不語 沉默不语|沈默寡言 沉默寡言|沙逕 沙迳|河逕 河迳|流徵 流徵|浪蕩乾坤 浪荡乾坤|浮沈 浮沉|海哩 海里|深沈 深沉|深沈不露 深沉不露|溫昇豪 温昇豪|滑藉 滑借|烏昇 乌昇|烏沈沈 乌沉沉|烏逕 乌迳|無序 无序|狐藉虎威 狐借虎威|王彥昇 王彦昇|珍珠項鍊 珍珠项链|甚鉅 甚钜|甦生 苏生|甦醒 苏醒|申昇勳 申昇勋|申覆 申复|畢昇 毕昇|發覆 发覆|盧象昇 卢象昇|目劄 目劄|瞭哨 瞭哨|瞭如 了如|瞭如指掌 了如指掌|瞭望 瞭望|瞭然 了然|瞭然於心 了然于心|瞭若指掌 了若指掌|瞭解 了解|瞭解到 了解到|破釜沈舟 破釜沉舟|磚坏 砖坯|示覆 示复|社逕 社迳|祕丕笈 祕丕笈|祕彭祖 祕彭祖|祕瓊 祕琼|祝釐 祝釐|神祇 神祇|稟覆 禀复|竺乾 竺乾|答覆 答复|篤麼 笃麽|簡單明瞭 简单明了|籌畫 筹划|素藉 素借|老態龍鍾 老态龙钟|耳沈 耳沉|肉脩 肉脩|肘手鍊足 肘手链足|胤祕 胤祕|脩敬 脩敬|脩炳 脩炳|脩脡 脩脡|脩脯 脩脯|脩金 脩金|脫坏 脱坯|腶脩 腶脩|英哩 英里|茅蒐 茅蒐|茵藉 茵借|萬鍾 万锺|落雁沈魚 落雁沉鱼|蒐于紅 蒐于红|蒐於紅 蒐于红|蒐狩 蒐狩|蒐獮 蒐狝|蒐獵 蒐猎|蒐田 蒐田|蒐畋 蒐畋|蒐苗 蒐苗|蒜薹 蒜薹|蔣昇 蒋昇|蕓薹 芸薹|蕩覆 荡覆|蕭乾 萧乾|藉代 借代|藉以 借以|藉助 借助|藉助於 借助于|藉卉 借卉|藉口 借口|藉喻 借喻|藉寇兵 借寇兵|藉寇兵齎盜糧 借寇兵赍盗粮|藉手 借手|藉據 借据|藉故 借故|藉故推辭 借故推辞|藉方 借方|藉條 借条|藉槁 借槁|藉機 借机|藉此 借此|藉此機會 借此机会|藉甚 借甚|藉由 借由|藉着 借着|藉端 借端|藉端生事 借端生事|藉箸代籌 借箸代筹|藉草枕塊 借草枕块|藉藉 藉藉|藉藉无名 藉藉无名|藉詞 借词|藉讀 借读|藉資 借资|衹得 只得|衹見樹木 只见树木|衹見樹木不見森林 只见树木不见森林|袁祕 袁祕|袖裏乾坤 袖里乾坤|袷袢 袷袢|製坏 制坯|覆上 覆上|覆住 覆住|覆信 复信|覆冒 覆冒|覆呈 复呈|覆命 复命|覆墓 复墓|覆宗 覆宗|覆帳 复帐|覆幬 覆帱|覆成 覆成|覆按 复按|覆文 复文|覆杯 覆杯|覆校 复校|覆瓿 覆瓿|覆盂 覆盂|覆盆 覆盆|覆盆子 覆盆子|覆盤 覆盘|覆育 覆育|覆蕉尋鹿 覆蕉寻鹿|覆逆 覆逆|覆醢 覆醢|覆醬瓿 覆酱瓿|覆電 复电|覆露 覆露|覆鹿尋蕉 覆鹿寻蕉|覆鹿遺蕉 覆鹿遗蕉|覆鼎 覆鼎|見覆 见复|角徵 角徵|角徵羽 角徵羽|計畫 计划|許甦魂 许甦魂|變徵 变徵|變徵之聲 变徵之声|變徵之音 变徵之音|讎定 雠定|谿工 谿工|貂覆額 貂覆额|買臣覆水 买臣覆水|赤石逕 赤石迳|踅門瞭戶 踅门了户|躪藉 躏借|載沈載浮 载沉载浮|載浮載沈 载浮载沉|辛祕 辛祕|逆釐 逆釐|逕口 迳口|逕聯 迳联|逕頭 迳头|郭子乾 郭子乾|酒逢知己千鍾少 酒逢知己千锺少|醞藉 酝借|重覆 重复|金吒 金吒|金昇玟 金昇玟|金鍊 金链|鈞覆 钧复|鉅子 钜子|鉅萬 钜万|鉅防 钜防|鉸鍊 铰链|銀鍊 银链|鋼坏 钢坯|錢鍾書 钱锺书|鍊墜 链坠|鍊子 链子|鍊形 链形|鍊條 链条|鍊錘 链锤|鍊鎖 链锁|鍛鍾 锻锺|鍾繇 锺繇|鍾萬梅 锺万梅|鍾重發 锺重发|鍾鍛 锺锻|鍾馗 锺馗|鎖鍊 锁链|鐵鍊 铁链|鑽石項鍊 钻石项链|鑿坏 凿坯|閻鶴昇 阎鹤昇|陰沈 阴沉|陰沈沈 阴沉沉|陰陰沈沈 阴阴沉沉|陳志昇 陈志昇|陳昇 陈昇|陳甦 陈甦|陶坏 陶坯|雁杳魚沈 雁杳鱼沉|雖覆能復 虽覆能复|電覆 电复|露覆 露覆|韓昇延 韩昇延|韓甦 韩甦|項鍊 项链|頗覆 颇覆|頸鍊 颈链|顛乾倒坤 颠乾倒坤|顛倒乾坤 颠倒乾坤|顧藉 顾借|馮甦 冯甦|魏徵 魏徵|魚沈雁杳 鱼沉雁杳|麪坏兒 面坯儿|麼些族 麽些族|黃甦 黄甦|黃鍾公 黄锺公|黑沈沈 黑沉沉|龍鍾 龙钟|龔昇 龚昇", m = "㑯 㑔|㑳 㑇|㑶 㐹|㓨 刾|㗲 𠵾|㘚 㘎|㜄 㚯|㜏 㛣|㜢 𡞱|㠏 㟆|㠣 𫵷|㥮 㤘|㩜 㨫|㩳 㧐|㩵 擜|㺏 𤠋|䁪 𥇢|䁻 䀥|䃮 鿎|䊷 䌶|䋙 䌺|䋚 䌻|䋹 䌿|䋻 䌾|䍦 䍠|䎱 䎬|䓣 𬜯|䙡 䙌|䜀 䜧|䝼 䞍|䡵 𫟦|䥇 䦂|䥑 鿏|䥕 𬭯|䥱 䥾|䦛 䦶|䦟 䦷|䧢 𨸟|䮄 𫠊|䯀 䯅|䰾 鲃|䱷 䲣|䱽 䲝|䲁 鳚|䲘 鳤|䴉 鹮|丟 丢|並 并|乾 干|亂 乱|亙 亘|亞 亚|佇 伫|佈 布|佔 占|併 并|來 来|侖 仑|侶 侣|侷 局|俁 俣|係 系|俔 伣|俠 侠|俥 伡|俬 私|倀 伥|倆 俩|倈 俫|倉 仓|個 个|們 们|倖 幸|倫 伦|倲 㑈|偉 伟|偑 㐽|側 侧|偵 侦|偽 伪|傌 㐷|傑 杰|傖 伧|傘 伞|備 备|傢 家|傭 佣|傯 偬|傳 传|傴 伛|債 债|傷 伤|傾 倾|僂 偻|僅 仅|僉 佥|僑 侨|僕 仆|僞 伪|僤 𫢸|僥 侥|僨 偾|僱 雇|價 价|儀 仪|儁 俊|儂 侬|億 亿|儈 侩|儉 俭|儎 傤|儐 傧|儔 俦|儕 侪|儘 尽|償 偿|優 优|儲 储|儷 俪|儸 㑩|儺 傩|儻 傥|儼 俨|兇 凶|兌 兑|兒 儿|兗 兖|內 内|兩 两|冊 册|冑 胄|冪 幂|凈 净|凍 冻|凜 凛|凱 凯|別 别|刪 删|剄 刭|則 则|剋 克|剎 刹|剗 刬|剛 刚|剝 剥|剮 剐|剴 剀|創 创|剷 铲|劃 划|劄 札|劇 剧|劉 刘|劊 刽|劌 刿|劍 剑|劏 㓥|劑 剂|劚 㔉|勁 劲|動 动|務 务|勛 勋|勝 胜|勞 劳|勢 势|勣 𪟝|勩 勚|勱 劢|勳 勋|勵 励|勸 劝|勻 匀|匭 匦|匯 汇|匱 匮|區 区|協 协|卹 恤|卻 却|卽 即|厙 厍|厠 厕|厤 历|厭 厌|厲 厉|厴 厣|參 参|叄 叁|叢 丛|吒 咤|吳 吴|吶 呐|呂 吕|咼 呙|員 员|唄 呗|唸 念|問 问|啓 启|啞 哑|啟 启|啢 唡|喎 㖞|喚 唤|喪 丧|喫 吃|喬 乔|單 单|喲 哟|嗆 呛|嗇 啬|嗊 唝|嗎 吗|嗚 呜|嗩 唢|嗰 𠮶|嗶 哔|嘆 叹|嘍 喽|嘓 啯|嘔 呕|嘖 啧|嘗 尝|嘜 唛|嘩 哗|嘮 唠|嘯 啸|嘰 叽|嘵 哓|嘸 呒|嘽 啴|噁 恶|噓 嘘|噚 㖊|噝 咝|噠 哒|噥 哝|噦 哕|噯 嗳|噲 哙|噴 喷|噸 吨|噹 当|嚀 咛|嚇 吓|嚌 哜|嚐 尝|嚕 噜|嚙 啮|嚥 咽|嚦 呖|嚧 𠰷|嚨 咙|嚮 向|嚲 亸|嚳 喾|嚴 严|嚶 嘤|囀 啭|囁 嗫|囂 嚣|囅 冁|囈 呓|囉 啰|囌 苏|囑 嘱|囪 囱|圇 囵|國 国|圍 围|園 园|圓 圆|圖 图|團 团|垻 坝|埡 垭|埨 𫭢|埰 采|執 执|堅 坚|堊 垩|堖 垴|堝 埚|堯 尧|報 报|場 场|塊 块|塋 茔|塏 垲|塒 埘|塗 涂|塚 冢|塢 坞|塤 埙|塵 尘|塸 𫭟|塹 堑|塿 𪣻|墊 垫|墜 坠|墠 𫮃|墮 堕|墰 坛|墳 坟|墶 垯|墻 墙|墾 垦|壇 坛|壋 垱|壎 埙|壓 压|壗 𡋤|壘 垒|壙 圹|壚 垆|壜 坛|壞 坏|壟 垄|壠 垅|壢 坜|壩 坝|壪 塆|壯 壮|壺 壶|壼 壸|壽 寿|夠 够|夢 梦|夥 伙|夾 夹|奐 奂|奧 奥|奩 奁|奪 夺|奬 奖|奮 奋|奼 姹|妝 妆|姍 姗|姦 奸|娙 𫰛|娛 娱|婁 娄|婦 妇|婭 娅|媧 娲|媯 妫|媰 㛀|媼 媪|媽 妈|嫋 袅|嫗 妪|嫵 妩|嫺 娴|嫻 娴|嫿 婳|嬀 妫|嬃 媭|嬈 娆|嬋 婵|嬌 娇|嬙 嫱|嬡 嫒|嬤 嬷|嬪 嫔|嬰 婴|嬸 婶|孃 娘|孋 㛤|孌 娈|孫 孙|學 学|孻 𡥧|孿 孪|宮 宫|寀 采|寢 寝|實 实|寧 宁|審 审|寫 写|寬 宽|寵 宠|寶 宝|將 将|專 专|尋 寻|對 对|導 导|尷 尴|屆 届|屍 尸|屓 屃|屜 屉|屢 屡|層 层|屨 屦|屬 属|岡 冈|峯 峰|峴 岘|島 岛|峽 峡|崍 崃|崑 昆|崗 岗|崙 仑|崢 峥|崬 岽|嵐 岚|嵗 岁|嵽 𫶇|嵾 㟥|嶁 嵝|嶄 崭|嶇 岖|嶔 嵚|嶗 崂|嶠 峤|嶢 峣|嶧 峄|嶨 峃|嶮 崄|嶸 嵘|嶺 岭|嶼 屿|嶽 岳|巋 岿|巒 峦|巔 巅|巖 岩|巘 𪩘|巰 巯|巹 卺|帥 帅|師 师|帳 帐|帶 带|幀 帧|幃 帏|幓 㡎|幗 帼|幘 帻|幟 帜|幣 币|幫 帮|幬 帱|幷 并|幹 干|幾 几|庫 库|廁 厕|廂 厢|廄 厩|廈 厦|廎 庼|廕 荫|廚 厨|廝 厮|廞 𫷷|廟 庙|廠 厂|廡 庑|廢 废|廣 广|廩 廪|廬 庐|廳 厅|弒 弑|弔 吊|弳 弪|張 张|強 强|彄 𫸩|彆 别|彈 弹|彌 弥|彎 弯|彔 录|彙 汇|彠 彟|彥 彦|彫 雕|彲 彨|彿 佛|後 后|徑 径|從 从|徠 徕|復 复|徵 征|徹 彻|恆 恒|恥 耻|悅 悦|悞 悮|悵 怅|悶 闷|悽 凄|惡 恶|惱 恼|惲 恽|惻 恻|愛 爱|愜 惬|愨 悫|愴 怆|愷 恺|愾 忾|慄 栗|態 态|慍 愠|慘 惨|慚 惭|慟 恸|慣 惯|慤 悫|慪 怄|慫 怂|慮 虑|慳 悭|慶 庆|慺 㥪|慼 戚|慾 欲|憂 忧|憊 惫|憐 怜|憑 凭|憒 愦|憖 慭|憚 惮|憤 愤|憫 悯|憮 怃|憲 宪|憶 忆|懇 恳|應 应|懌 怿|懍 懔|懞 蒙|懟 怼|懣 懑|懤 㤽|懨 恹|懲 惩|懶 懒|懷 怀|懸 悬|懺 忏|懼 惧|懾 慑|戀 恋|戇 戆|戔 戋|戧 戗|戩 戬|戰 战|戱 戯|戲 戏|戶 户|扞 捍|拋 抛|拚 拼|挩 捝|挱 挲|挾 挟|捨 舍|捫 扪|捱 挨|捲 卷|掃 扫|掄 抡|掆 㧏|掗 挜|掙 挣|掛 挂|採 采|揀 拣|揚 扬|換 换|揮 挥|揯 搄|損 损|搖 摇|搗 捣|搧 扇|搵 揾|搶 抢|摑 掴|摜 掼|摟 搂|摯 挚|摳 抠|摶 抟|摺 折|摻 掺|撈 捞|撏 挦|撐 撑|撓 挠|撝 㧑|撟 挢|撣 掸|撥 拨|撫 抚|撲 扑|撳 揿|撻 挞|撾 挝|撿 捡|擁 拥|擄 掳|擇 择|擊 击|擋 挡|擓 㧟|擔 担|據 据|擠 挤|擡 抬|擣 捣|擬 拟|擯 摈|擰 拧|擱 搁|擲 掷|擴 扩|擷 撷|擺 摆|擻 擞|擼 撸|擽 㧰|擾 扰|攄 摅|攆 撵|攏 拢|攔 拦|攖 撄|攙 搀|攛 撺|攜 携|攝 摄|攢 攒|攣 挛|攤 摊|攪 搅|攬 揽|敎 教|敓 敚|敗 败|敘 叙|敵 敌|數 数|斂 敛|斃 毙|斆 敩|斕 斓|斬 斩|斷 断|於 于|旂 旗|旣 既|昇 升|時 时|晉 晋|晛 𬀪|晝 昼|暈 晕|暉 晖|暐 𬀩|暘 旸|暢 畅|暫 暂|曄 晔|曆 历|曇 昙|曉 晓|曏 向|曖 暧|曠 旷|曥 𣆐|曨 昽|曬 晒|書 书|會 会|朥 𦛨|朧 胧|朮 术|東 东|枴 拐|柵 栅|柺 拐|査 查|桱 𣐕|桿 杆|梔 栀|梘 枧|梜 𬂩|條 条|梟 枭|梲 棁|棄 弃|棊 棋|棖 枨|棗 枣|棟 栋|棡 㭎|棧 栈|棲 栖|棶 梾|椏 桠|椲 㭏|楊 杨|楓 枫|楨 桢|業 业|極 极|榘 矩|榦 干|榪 杩|榮 荣|榲 榅|榿 桤|構 构|槍 枪|槓 杠|槤 梿|槧 椠|槨 椁|槮 椮|槳 桨|槶 椢|槼 椝|樁 桩|樂 乐|樅 枞|樑 梁|樓 楼|標 标|樞 枢|樢 㭤|樣 样|樧 榝|樫 㭴|樳 桪|樸 朴|樹 树|樺 桦|樿 椫|橈 桡|橋 桥|機 机|橢 椭|橫 横|橯 𣓿|檁 檩|檉 柽|檔 档|檜 桧|檟 槚|檢 检|檣 樯|檮 梼|檯 台|檳 槟|檸 柠|檻 槛|櫃 柜|櫍 𬃊|櫓 橹|櫚 榈|櫛 栉|櫝 椟|櫞 橼|櫟 栎|櫥 橱|櫧 槠|櫨 栌|櫪 枥|櫫 橥|櫬 榇|櫱 蘖|櫳 栊|櫸 榉|櫻 樱|欄 栏|欅 榉|權 权|欏 椤|欒 栾|欓 𣗋|欖 榄|欞 棂|欽 钦|歎 叹|歐 欧|歟 欤|歡 欢|歲 岁|歷 历|歸 归|歿 殁|殘 残|殞 殒|殤 殇|殨 㱮|殫 殚|殭 僵|殮 殓|殯 殡|殰 㱩|殲 歼|殺 杀|殻 壳|殼 壳|毀 毁|毆 殴|毿 毵|氂 牦|氈 毡|氌 氇|氣 气|氫 氢|氬 氩|氳 氲|氾 泛|汎 泛|汙 污|決 决|沒 没|沖 冲|況 况|泝 溯|洩 泄|洶 汹|浹 浃|浿 𬇙|涇 泾|涗 涚|涼 凉|淒 凄|淚 泪|淥 渌|淨 净|淩 凌|淪 沦|淵 渊|淶 涞|淺 浅|渙 涣|減 减|渢 沨|渦 涡|測 测|渾 浑|湊 凑|湋 𣲗|湞 浈|湧 涌|湯 汤|溈 沩|準 准|溝 沟|溫 温|溮 浉|溳 涢|溼 湿|滄 沧|滅 灭|滌 涤|滎 荥|滙 汇|滬 沪|滯 滞|滲 渗|滷 卤|滸 浒|滻 浐|滾 滚|滿 满|漁 渔|漊 溇|漍 𬇹|漚 沤|漢 汉|漣 涟|漬 渍|漲 涨|漵 溆|漸 渐|漿 浆|潁 颍|潑 泼|潔 洁|潕 𣲘|潙 沩|潚 㴋|潛 潜|潤 润|潯 浔|潰 溃|潷 滗|潿 涠|澀 涩|澆 浇|澇 涝|澐 沄|澗 涧|澠 渑|澤 泽|澦 滪|澩 泶|澫 𬇕|澮 浍|澱 淀|澾 㳠|濁 浊|濃 浓|濄 㳡|濆 𣸣|濕 湿|濘 泞|濚 溁|濛 蒙|濜 浕|濟 济|濤 涛|濧 㳔|濫 滥|濰 潍|濱 滨|濺 溅|濼 泺|濾 滤|瀂 澛|瀅 滢|瀆 渎|瀇 㲿|瀉 泻|瀋 沈|瀏 浏|瀕 濒|瀘 泸|瀝 沥|瀟 潇|瀠 潆|瀦 潴|瀧 泷|瀨 濑|瀰 弥|瀲 潋|瀾 澜|灃 沣|灄 滠|灑 洒|灒 𪷽|灕 漓|灘 滩|灙 𣺼|灝 灏|灡 㳕|灣 湾|灤 滦|灧 滟|灩 滟|災 灾|為 为|烏 乌|烴 烃|無 无|煉 炼|煒 炜|煙 烟|煢 茕|煥 焕|煩 烦|煬 炀|煱 㶽|熅 煴|熒 荧|熗 炝|熰 𬉼|熱 热|熲 颎|熾 炽|燀 𬊤|燁 烨|燈 灯|燉 炖|燒 烧|燖 𬊈|燙 烫|燜 焖|營 营|燦 灿|燬 毁|燭 烛|燴 烩|燶 㶶|燻 熏|燼 烬|燾 焘|爍 烁|爐 炉|爛 烂|爭 争|爲 为|爺 爷|爾 尔|牀 床|牆 墙|牘 牍|牴 抵|牽 牵|犖 荦|犛 牦|犢 犊|犧 牺|狀 状|狹 狭|狽 狈|猙 狰|猶 犹|猻 狲|獁 犸|獃 呆|獄 狱|獅 狮|獎 奖|獨 独|獪 狯|獫 猃|獮 狝|獰 狞|獱 㺍|獲 获|獵 猎|獷 犷|獸 兽|獺 獭|獻 献|獼 猕|玀 猡|現 现|琱 雕|琺 珐|琿 珲|瑋 玮|瑒 玚|瑣 琐|瑤 瑶|瑩 莹|瑪 玛|瑲 玱|璉 琏|璊 𫞩|璕 𬍤|璗 𬍡|璡 琎|璣 玑|璦 瑷|璫 珰|璯 㻅|環 环|璵 玙|璸 瑸|璽 玺|璿 璇|瓅 𬍛|瓊 琼|瓏 珑|瓔 璎|瓚 瓒|瓛 𤩽|甌 瓯|甕 瓮|產 产|産 产|畝 亩|畢 毕|畫 画|異 异|畵 画|當 当|疇 畴|疊 叠|痙 痉|痠 酸|痾 疴|瘂 痖|瘋 疯|瘍 疡|瘓 痪|瘞 瘗|瘡 疮|瘧 疟|瘮 瘆|瘲 疭|瘺 瘘|瘻 瘘|療 疗|癆 痨|癇 痫|癉 瘅|癒 愈|癘 疠|癟 瘪|癡 痴|癢 痒|癤 疖|癥 症|癧 疬|癩 癞|癬 癣|癭 瘿|癮 瘾|癰 痈|癱 瘫|癲 癫|發 发|皁 皂|皚 皑|皰 疱|皸 皲|皺 皱|盃 杯|盜 盗|盞 盏|盡 尽|監 监|盤 盘|盧 卢|盪 荡|眞 真|眥 眦|眾 众|睍 𪾢|睏 困|睜 睁|睞 睐|瞘 眍|瞜 䁖|瞞 瞒|瞶 瞆|瞼 睑|矇 蒙|矓 眬|矚 瞩|矯 矫|硃 朱|硜 硁|硤 硖|硨 砗|硯 砚|碕 埼|碩 硕|碭 砀|碸 砜|確 确|碼 码|碽 䂵|磑 硙|磚 砖|磠 硵|磣 碜|磧 碛|磯 矶|磽 硗|磾 䃅|礄 硚|礎 础|礐 𬒈|礙 碍|礦 矿|礪 砺|礫 砾|礬 矾|礱 砻|祕 秘|祿 禄|禍 祸|禎 祯|禕 祎|禡 祃|禦 御|禪 禅|禮 礼|禰 祢|禱 祷|禿 秃|秈 籼|稅 税|稈 秆|稏 䅉|稜 棱|稟 禀|種 种|稱 称|穀 谷|穇 䅟|穌 稣|積 积|穎 颖|穠 秾|穡 穑|穢 秽|穩 稳|穫 获|穭 穞|窩 窝|窪 洼|窮 穷|窯 窑|窵 窎|窶 窭|窺 窥|竄 窜|竅 窍|竇 窦|竈 灶|竊 窃|竪 竖|競 竞|筆 笔|筍 笋|筧 笕|筴 䇲|箇 个|箋 笺|箏 筝|箚 札|節 节|範 范|築 筑|篋 箧|篔 筼|篠 筿|篢 𬕂|篤 笃|篩 筛|篳 筚|篸 𥮾|簀 箦|簍 篓|簑 蓑|簞 箪|簡 简|簣 篑|簫 箫|簹 筜|簽 签|簾 帘|籃 篮|籅 𥫣|籌 筹|籔 䉤|籙 箓|籛 篯|籜 箨|籟 籁|籠 笼|籤 签|籩 笾|籪 簖|籬 篱|籮 箩|籲 吁|粵 粤|糉 粽|糝 糁|糞 粪|糧 粮|糰 团|糲 粝|糴 籴|糶 粜|糹 纟|糾 纠|紀 纪|紂 纣|紃 𬘓|約 约|紅 红|紆 纡|紇 纥|紈 纨|紉 纫|紋 纹|納 纳|紐 纽|紓 纾|純 纯|紕 纰|紖 纼|紗 纱|紘 纮|紙 纸|級 级|紛 纷|紜 纭|紝 纴|紞 𬘘|紡 纺|紬 䌷|紮 扎|細 细|紱 绂|紲 绁|紳 绅|紵 纻|紹 绍|紺 绀|紼 绋|紿 绐|絀 绌|終 终|絃 弦|組 组|絅 䌹|絆 绊|絎 绗|結 结|絕 绝|絛 绦|絝 绔|絞 绞|絡 络|絢 绚|給 给|絨 绒|絪 𬘡|絰 绖|統 统|絲 丝|絳 绛|絶 绝|絹 绢|絺 𫄨|綁 绑|綃 绡|綄 𬘫|綆 绠|綈 绨|綉 绣|綌 绤|綎 𬘩|綏 绥|綐 䌼|綑 捆|經 经|綖 𫄧|綜 综|綝 𬘭|綞 缍|綠 绿|綡 𫟅|綢 绸|綣 绻|綧 𬘯|綪 𬘬|綫 线|綬 绶|維 维|綯 绹|綰 绾|綱 纲|網 网|綳 绷|綴 缀|綵 彩|綸 纶|綹 绺|綺 绮|綻 绽|綽 绰|綾 绫|綿 绵|緄 绲|緇 缁|緊 紧|緋 绯|緑 绿|緒 绪|緓 绬|緔 绱|緗 缃|緘 缄|緙 缂|線 线|緝 缉|緞 缎|締 缔|緡 缗|緣 缘|緦 缌|編 编|緩 缓|緬 缅|緯 纬|緱 缑|緲 缈|練 练|緶 缏|緹 缇|緻 致|緼 缊|縈 萦|縉 缙|縊 缢|縋 缒|縐 绉|縑 缣|縕 缊|縗 缞|縛 缚|縝 缜|縞 缟|縟 缛|縣 县|縧 绦|縫 缝|縭 缡|縮 缩|縯 𬙂|縱 纵|縲 缧|縳 䌸|縴 纤|縵 缦|縶 絷|縷 缕|縹 缥|總 总|績 绩|繃 绷|繅 缫|繆 缪|繒 缯|織 织|繕 缮|繚 缭|繞 绕|繡 绣|繢 缋|繩 绳|繪 绘|繫 系|繭 茧|繮 缰|繯 缳|繰 缲|繳 缴|繶 𫄷|繸 䍁|繹 绎|繻 𦈡|繼 继|繽 缤|繾 缱|繿 䍀|纁 𫄸|纆 𬙊|纇 颣|纈 缬|纊 纩|續 续|纍 累|纏 缠|纓 缨|纔 才|纕 𬙋|纖 纤|纘 缵|纜 缆|缽 钵|罃 䓨|罈 坛|罌 罂|罎 坛|罰 罚|罵 骂|罷 罢|羅 罗|羆 罴|羈 羁|羋 芈|羣 群|羥 羟|羨 羡|義 义|羶 膻|習 习|翫 玩|翬 翚|翹 翘|翽 翙|耬 耧|耮 耢|聖 圣|聞 闻|聯 联|聰 聪|聲 声|聳 耸|聵 聩|聶 聂|職 职|聹 聍|聽 听|聾 聋|肅 肃|脅 胁|脈 脉|脛 胫|脣 唇|脩 修|脫 脱|脹 胀|腎 肾|腖 胨|腡 脶|腦 脑|腫 肿|腳 脚|腸 肠|膃 腽|膕 腘|膚 肤|膞 䏝|膠 胶|膢 𦝼|膩 腻|膽 胆|膾 脍|膿 脓|臉 脸|臍 脐|臏 膑|臘 腊|臚 胪|臟 脏|臠 脔|臢 臜|臥 卧|臨 临|臺 台|與 与|興 兴|舉 举|舊 旧|舖 铺|舘 馆|艙 舱|艤 舣|艦 舰|艫 舻|艱 艰|艷 艳|芻 刍|苧 苎|茲 兹|荊 荆|莊 庄|莖 茎|莢 荚|莧 苋|華 华|菴 庵|菸 烟|萇 苌|萊 莱|萬 万|萴 荝|萵 莴|葉 叶|葒 荭|葤 荮|葦 苇|葯 药|葷 荤|蒍 𫇭|蒐 搜|蒓 莼|蒔 莳|蒕 蒀|蒞 莅|蒼 苍|蓀 荪|蓆 席|蓋 盖|蓮 莲|蓯 苁|蓴 莼|蓽 荜|蔄 𬜬|蔔 卜|蔘 参|蔞 蒌|蔣 蒋|蔥 葱|蔦 茑|蔭 荫|蔯 𫈟|蔿 𫇭|蕁 荨|蕆 蒇|蕎 荞|蕒 荬|蕓 芸|蕕 莸|蕘 荛|蕢 蒉|蕩 荡|蕪 芜|蕭 萧|蕷 蓣|薀 蕰|薈 荟|薊 蓟|薌 芗|薑 姜|薔 蔷|薘 荙|薟 莶|薦 荐|薩 萨|薳 䓕|薴 苧|薵 䓓|薹 苔|薺 荠|藍 蓝|藎 荩|藝 艺|藥 药|藪 薮|藭 䓖|藴 蕴|藶 苈|藹 蔼|藺 蔺|蘀 萚|蘄 蕲|蘆 芦|蘇 苏|蘊 蕴|蘋 苹|蘚 藓|蘞 蔹|蘟 𦻕|蘢 茏|蘭 兰|蘺 蓠|蘿 萝|虆 蔂|虉 𬟁|處 处|虛 虚|虜 虏|號 号|虧 亏|虯 虬|蛺 蛱|蛻 蜕|蜆 蚬|蝀 𬟽|蝕 蚀|蝟 猬|蝦 虾|蝨 虱|蝸 蜗|螄 蛳|螞 蚂|螢 萤|螮 䗖|螻 蝼|螿 螀|蟄 蛰|蟈 蝈|蟎 螨|蟣 虮|蟬 蝉|蟯 蛲|蟲 虫|蟳 𫊻|蟶 蛏|蟻 蚁|蠁 蚃|蠅 蝇|蠆 虿|蠍 蝎|蠐 蛴|蠑 蝾|蠔 蚝|蠟 蜡|蠣 蛎|蠨 蟏|蠱 蛊|蠶 蚕|蠻 蛮|衆 众|衊 蔑|術 术|衕 同|衚 胡|衛 卫|衝 冲|袞 衮|袷 夹|裊 袅|裏 里|補 补|裝 装|裡 里|製 制|複 复|褌 裈|褘 袆|褲 裤|褳 裢|褸 褛|褻 亵|襀 𫌀|襇 裥|襉 裥|襏 袯|襖 袄|襝 裣|襠 裆|襤 褴|襪 袜|襬 摆|襯 衬|襲 袭|襴 襕|覈 核|見 见|覎 觃|規 规|覓 觅|視 视|覘 觇|覡 觋|覥 觍|覦 觎|親 亲|覬 觊|覯 觏|覲 觐|覷 觑|覺 觉|覽 览|覿 觌|觀 观|觴 觞|觶 觯|觸 触|訁 讠|訂 订|訃 讣|計 计|訊 讯|訌 讧|討 讨|訏 𬣙|訐 讦|訒 讱|訓 训|訕 讪|訖 讫|託 托|記 记|訛 讹|訝 讶|訟 讼|訢 䜣|訣 诀|訥 讷|訩 讻|訪 访|設 设|許 许|訴 诉|訶 诃|診 诊|註 注|証 证|詀 𧮪|詁 诂|詆 诋|詎 讵|詐 诈|詒 诒|詔 诏|評 评|詖 诐|詗 诇|詘 诎|詛 诅|詝 𬣞|詞 词|詠 咏|詡 诩|詢 询|詣 诣|試 试|詩 诗|詪 𬣳|詫 诧|詬 诟|詭 诡|詮 诠|詰 诘|話 话|該 该|詳 详|詵 诜|詷 𫍣|詼 诙|詿 诖|誄 诔|誅 诛|誆 诓|誇 夸|誌 志|認 认|誑 诳|誒 诶|誕 诞|誘 诱|誚 诮|語 语|誠 诚|誡 诫|誣 诬|誤 误|誥 诰|誦 诵|誨 诲|說 说|説 说|誰 谁|課 课|誶 谇|誹 诽|誼 谊|誾 訚|調 调|諂 谄|諄 谆|談 谈|諉 诿|請 请|諍 诤|諏 诹|諑 诼|諒 谅|諓 𬣡|論 论|諗 谂|諛 谀|諜 谍|諝 谞|諞 谝|諟 𬤊|諡 谥|諢 诨|諤 谔|諦 谛|諧 谐|諫 谏|諭 谕|諮 咨|諱 讳|諲 𬤇|諳 谙|諴 𫍯|諶 谌|諷 讽|諸 诸|諺 谚|諼 谖|諾 诺|謀 谋|謁 谒|謂 谓|謄 誊|謅 诌|謊 谎|謎 谜|謏 𫍲|謐 谧|謔 谑|謖 谡|謗 谤|謙 谦|謚 谥|講 讲|謝 谢|謠 谣|謡 谣|謨 谟|謫 谪|謬 谬|謭 谫|謳 讴|謹 谨|謾 谩|譁 哗|證 证|譎 谲|譏 讥|譓 𬤝|譖 谮|識 识|譙 谯|譚 谭|譜 谱|譞 𫍽|譟 噪|譫 谵|譭 毁|譯 译|議 议|譴 谴|護 护|譸 诪|譽 誉|譾 谫|讀 读|讅 谉|變 变|讋 詟|讌 䜩|讎 雠|讒 谗|讓 让|讕 谰|讖 谶|讚 赞|讜 谠|讞 谳|谿 溪|豈 岂|豎 竖|豐 丰|豔 艳|豬 猪|豶 豮|貍 狸|貓 猫|貙 䝙|貝 贝|貞 贞|貟 贠|負 负|財 财|貢 贡|貧 贫|貨 货|販 贩|貪 贪|貫 贯|責 责|貯 贮|貰 贳|貲 赀|貳 贰|貴 贵|貶 贬|買 买|貸 贷|貺 贶|費 费|貼 贴|貽 贻|貿 贸|賀 贺|賁 贲|賂 赂|賃 赁|賄 贿|賅 赅|資 资|賈 贾|賊 贼|賑 赈|賒 赊|賓 宾|賕 赇|賙 赒|賚 赉|賜 赐|賞 赏|賠 赔|賡 赓|賢 贤|賣 卖|賤 贱|賦 赋|賧 赕|質 质|賫 赍|賬 账|賭 赌|賰 䞐|賴 赖|賵 赗|賺 赚|賻 赙|購 购|賽 赛|賾 赜|贄 贽|贅 赘|贇 赟|贈 赠|贊 赞|贋 赝|贍 赡|贏 赢|贐 赆|贓 赃|贔 赑|贖 赎|贗 赝|贛 赣|贜 赃|赬 赪|趕 赶|趙 赵|趨 趋|趲 趱|跡 迹|踐 践|踰 逾|踴 踊|蹌 跄|蹕 跸|蹟 迹|蹠 跖|蹣 蹒|蹤 踪|蹺 跷|躂 跶|躉 趸|躊 踌|躋 跻|躍 跃|躎 䟢|躑 踯|躒 跞|躓 踬|躕 蹰|躚 跹|躡 蹑|躥 蹿|躦 躜|躪 躏|軀 躯|車 车|軋 轧|軌 轨|軍 军|軏 𫐄|軑 轪|軒 轩|軔 轫|軛 轭|軝 𬨂|軟 软|軤 轷|軫 轸|軲 轱|軸 轴|軹 轵|軺 轺|軻 轲|軼 轶|軾 轼|較 较|輄 𨐈|輅 辂|輇 辁|輈 辀|載 载|輊 轾|輋 𪨶|輒 辄|輓 挽|輔 辅|輕 轻|輗 𫐐|輛 辆|輜 辎|輝 辉|輞 辋|輟 辍|輥 辊|輦 辇|輩 辈|輪 轮|輬 辌|輮 𫐓|輯 辑|輳 辏|輶 𬨎|輸 输|輻 辐|輼 辒|輾 辗|輿 舆|轀 辒|轂 毂|轄 辖|轅 辕|轆 辘|轉 转|轍 辙|轎 轿|轔 辚|轟 轰|轡 辔|轢 轹|轤 轳|辦 办|辭 辞|辮 辫|辯 辩|農 农|迴 回|逕 径|這 这|連 连|週 周|進 进|遊 游|運 运|過 过|達 达|違 违|遙 遥|遜 逊|遞 递|遠 远|遡 溯|適 适|遲 迟|遶 绕|遷 迁|選 选|遺 遗|遼 辽|邁 迈|還 还|邇 迩|邊 边|邏 逻|邐 逦|郟 郏|郵 邮|鄆 郓|鄉 乡|鄒 邹|鄔 邬|鄖 郧|鄧 邓|鄩 𬩽|鄭 郑|鄰 邻|鄲 郸|鄳 𫑡|鄴 邺|鄶 郐|鄺 邝|酇 酂|酈 郦|醃 腌|醖 酝|醜 丑|醞 酝|醟 蒏|醣 糖|醫 医|醬 酱|醱 酦|醲 𬪩|釀 酿|釁 衅|釃 酾|釅 酽|釋 释|釐 厘|釒 钅|釓 钆|釔 钇|釕 钌|釗 钊|釘 钉|釙 钋|針 针|釣 钓|釤 钐|釦 扣|釧 钏|釩 钒|釴 𬬩|釵 钗|釷 钍|釹 钕|釺 钎|釾 䥺|釿 𬬱|鈀 钯|鈁 钫|鈃 钘|鈄 钭|鈅 钥|鈇 𫓧|鈈 钚|鈉 钠|鈍 钝|鈎 钩|鈐 钤|鈑 钣|鈒 钑|鈔 钞|鈕 钮|鈞 钧|鈡 钟|鈣 钙|鈥 钬|鈦 钛|鈧 钪|鈮 铌|鈰 铈|鈳 钶|鈴 铃|鈷 钴|鈸 钹|鈹 铍|鈺 钰|鈽 钸|鈾 铀|鈿 钿|鉀 钾|鉅 巨|鉆 钻|鉈 铊|鉉 铉|鉊 𬬿|鉋 铇|鉍 铋|鉑 铂|鉕 钷|鉗 钳|鉚 铆|鉛 铅|鉝 𫟷|鉞 钺|鉢 钵|鉤 钩|鉥 𬬸|鉦 钲|鉧 𬭁|鉬 钼|鉭 钽|鉮 𬬹|鉳 锫|鉶 铏|鉷 𫟹|鉸 铰|鉺 铒|鉻 铬|鉿 铪|銀 银|銃 铳|銅 铜|銈 𫓯|銍 铚|銑 铣|銓 铨|銖 铢|銘 铭|銚 铫|銛 铦|銜 衔|銠 铑|銣 铷|銥 铱|銦 铟|銨 铵|銩 铥|銪 铕|銫 铯|銬 铐|銱 铞|銳 锐|銶 𨱇|銷 销|銹 锈|銻 锑|銼 锉|鋁 铝|鋃 锒|鋅 锌|鋇 钡|鋌 铤|鋏 铗|鋐 𬭎|鋒 锋|鋗 𫓶|鋙 铻|鋝 锊|鋟 锓|鋣 铘|鋤 锄|鋥 锃|鋦 锔|鋨 锇|鋩 铓|鋪 铺|鋭 锐|鋮 铖|鋯 锆|鋰 锂|鋱 铽|鋶 锍|鋸 锯|鋹 𬬮|鋼 钢|錀 𬬭|錁 锞|錄 录|錆 锖|錇 锫|錈 锩|錏 铔|錐 锥|錒 锕|錕 锟|錘 锤|錙 锱|錚 铮|錛 锛|錞 𬭚|錟 锬|錠 锭|錡 锜|錢 钱|錤 𫓹|錦 锦|錨 锚|錩 锠|錫 锡|錮 锢|錯 错|録 录|錳 锰|錶 表|錸 铼|錼 镎|鍀 锝|鍁 锨|鍃 锪|鍅 钫|鍆 钔|鍇 锴|鍈 锳|鍊 炼|鍋 锅|鍍 镀|鍔 锷|鍘 铡|鍚 钖|鍛 锻|鍠 锽|鍤 锸|鍥 锲|鍩 锘|鍬 锹|鍭 𬭤|鍰 锾|鍵 键|鍶 锶|鍺 锗|鍼 针|鍾 钟|鎂 镁|鎄 锿|鎇 镅|鎊 镑|鎌 镰|鎓 𬭩|鎔 镕|鎖 锁|鎘 镉|鎚 锤|鎛 镈|鎝 𨱏|鎡 镃|鎢 钨|鎣 蓥|鎦 镏|鎧 铠|鎩 铩|鎪 锼|鎬 镐|鎭 镇|鎮 镇|鎰 镒|鎲 镋|鎳 镍|鎵 镓|鎶 鿔|鎸 镌|鎿 镎|鏃 镞|鏇 旋|鏈 链|鏌 镆|鏍 镙|鏏 𬭬|鏐 镠|鏑 镝|鏗 铿|鏘 锵|鏜 镗|鏝 镘|鏞 镛|鏟 铲|鏡 镜|鏢 镖|鏤 镂|鏨 錾|鏰 镚|鏵 铧|鏷 镤|鏹 镪|鏺 䥽|鏻 𬭸|鏽 锈|鐃 铙|鐄 𨱑|鐇 𫔍|鐋 铴|鐍 𫔎|鐏 𨱔|鐐 镣|鐒 铹|鐓 镦|鐔 镡|鐘 钟|鐙 镫|鐝 镢|鐠 镨|鐥 䦅|鐦 锎|鐧 锏|鐨 镄|鐩 𬭼|鐫 镌|鐮 镰|鐯 䦃|鐲 镯|鐳 镭|鐵 铁|鐶 镮|鐸 铎|鐺 铛|鐽 𫟼|鐿 镱|鑄 铸|鑊 镬|鑌 镔|鑑 鉴|鑒 鉴|鑔 镲|鑕 锧|鑞 镴|鑠 铄|鑣 镳|鑥 镥|鑪 𬬻|鑭 镧|鑰 钥|鑱 镵|鑲 镶|鑷 镊|鑹 镩|鑼 锣|鑽 钻|鑾 銮|鑿 凿|钁 镢|钂 镋|長 长|門 门|閂 闩|閃 闪|閆 闫|閈 闬|閉 闭|開 开|閌 闶|閎 闳|閏 闰|閑 闲|閒 闲|間 间|閔 闵|閘 闸|閡 阂|閣 阁|閤 合|閥 阀|閨 闺|閩 闽|閫 阃|閬 阆|閭 闾|閱 阅|閲 阅|閶 阊|閹 阉|閻 阎|閼 阏|閽 阍|閾 阈|閿 阌|闃 阒|闆 板|闇 暗|闈 闱|闉 𬮱|闊 阔|闋 阕|闌 阑|闍 阇|闐 阗|闑 𫔶|闒 阘|闓 闿|闔 阖|闕 阙|闖 闯|關 关|闞 阚|闠 阓|闡 阐|闢 辟|闤 阛|闥 闼|陘 陉|陝 陕|陞 升|陣 阵|陰 阴|陳 陈|陸 陆|陽 阳|隉 陧|隊 队|階 阶|隑 𬮿|隕 陨|際 际|隤 𬯎|隨 随|險 险|隮 𬯀|隯 陦|隱 隐|隴 陇|隸 隶|隻 只|雋 隽|雖 虽|雙 双|雛 雏|雜 杂|雞 鸡|離 离|難 难|雲 云|電 电|霑 沾|霢 霡|霧 雾|霽 霁|靂 雳|靄 霭|靆 叇|靈 灵|靉 叆|靚 靓|靜 静|靝 靔|靦 腼|靨 靥|鞏 巩|鞝 绱|鞦 秋|鞽 鞒|韁 缰|韃 鞑|韆 千|韉 鞯|韋 韦|韌 韧|韍 韨|韓 韩|韙 韪|韜 韬|韝 鞲|韞 韫|韻 韵|響 响|頁 页|頂 顶|頃 顷|項 项|順 顺|頇 顸|須 须|頊 顼|頌 颂|頍 𫠆|頎 颀|頏 颃|預 预|頑 顽|頒 颁|頓 顿|頔 𬱖|頗 颇|領 领|頜 颌|頠 𬱟|頡 颉|頤 颐|頦 颏|頫 𫖯|頭 头|頮 颒|頰 颊|頲 颋|頴 颕|頵 𫖳|頷 颔|頸 颈|頹 颓|頻 频|頽 颓|顆 颗|題 题|額 额|顎 颚|顏 颜|顒 颙|顓 颛|顔 颜|顗 𫖮|願 愿|顙 颡|顛 颠|類 类|顢 颟|顥 颢|顧 顾|顫 颤|顬 颥|顯 显|顰 颦|顱 颅|顳 颞|顴 颧|風 风|颭 飐|颮 飑|颯 飒|颱 台|颳 刮|颶 飓|颸 飔|颺 飏|颻 飖|颼 飕|飀 飗|飄 飘|飆 飙|飈 飚|飛 飞|飠 饣|飢 饥|飣 饤|飥 饦|飩 饨|飪 饪|飫 饫|飭 饬|飯 饭|飱 飧|飲 饮|飴 饴|飼 饲|飽 饱|飾 饰|飿 饳|餃 饺|餄 饸|餅 饼|餈 糍|餉 饷|養 养|餌 饵|餎 饹|餏 饻|餑 饽|餒 馁|餓 饿|餕 馂|餖 饾|餗 𫗧|餘 余|餚 肴|餛 馄|餜 馃|餞 饯|餡 馅|館 馆|餬 糊|餱 糇|餳 饧|餵 喂|餶 馉|餷 馇|餸 𩠌|餺 馎|餼 饩|餾 馏|餿 馊|饁 馌|饃 馍|饅 馒|饈 馐|饉 馑|饊 馓|饋 馈|饌 馔|饑 饥|饒 饶|饗 飨|饘 𫗴|饜 餍|饞 馋|饢 馕|馬 马|馭 驭|馮 冯|馱 驮|馳 驰|馴 驯|馹 驲|馼 𫘜|駁 驳|駃 𫘝|駉 𬳶|駐 驻|駑 驽|駒 驹|駓 𬳵|駔 驵|駕 驾|駘 骀|駙 驸|駛 驶|駝 驼|駟 驷|駡 骂|駢 骈|駪 𬳽|駭 骇|駰 骃|駱 骆|駸 骎|駼 𬳿|駿 骏|騁 骋|騂 骍|騄 𫘧|騅 骓|騊 𫘦|騌 骔|騍 骒|騎 骑|騏 骐|騑 𬴂|騖 骛|騙 骗|騞 𬴃|騠 𫘨|騤 骙|騧 䯄|騫 骞|騭 骘|騮 骝|騰 腾|騱 𫘬|騵 𫘪|騶 驺|騷 骚|騸 骟|騾 骡|驀 蓦|驁 骜|驂 骖|驃 骠|驄 骢|驅 驱|驊 骅|驌 骕|驍 骁|驎 𬴊|驏 骣|驕 骄|驗 验|驚 惊|驛 驿|驟 骤|驢 驴|驤 骧|驥 骥|驦 骦|驪 骊|驫 骉|骯 肮|髏 髅|髒 脏|體 体|髕 髌|髖 髋|髮 发|鬆 松|鬍 胡|鬚 须|鬢 鬓|鬥 斗|鬧 闹|鬨 哄|鬩 阋|鬮 阄|鬱 郁|鬹 鬶|魎 魉|魘 魇|魚 鱼|魛 鱽|魟 𫚉|魢 鱾|魨 鲀|魯 鲁|魴 鲂|魷 鱿|魺 鲄|鮀 𬶍|鮁 鲅|鮃 鲆|鮆 𫚖|鮈 𬶋|鮊 鲌|鮋 鲉|鮍 鲏|鮎 鲇|鮐 鲐|鮑 鲍|鮒 鲋|鮓 鲊|鮚 鲒|鮜 鲘|鮝 鲞|鮞 鲕|鮟 𩽾|鮠 𬶏|鮡 𬶐|鮣 䲟|鮦 鲖|鮪 鲔|鮫 鲛|鮭 鲑|鮮 鲜|鮳 鲓|鮶 鲪|鮸 𩾃|鮺 鲝|鯀 鲧|鯁 鲠|鯇 鲩|鯉 鲤|鯊 鲨|鯒 鲬|鯔 鲻|鯕 鲯|鯖 鲭|鯗 鲞|鯛 鲷|鯝 鲴|鯡 鲱|鯢 鲵|鯤 鲲|鯧 鲳|鯨 鲸|鯪 鲮|鯫 鲰|鯰 鲶|鯴 鲺|鯷 鳀|鯻 𬶟|鯽 鲫|鯿 鳊|鰁 鳈|鰂 鲗|鰃 鳂|鰆 䲠|鰈 鲽|鰉 鳇|鰊 𬶠|鰌 䲡|鰍 鳅|鰏 鲾|鰐 鳄|鰒 鳆|鰓 鳃|鰛 鳁|鰜 鳒|鰟 鳑|鰠 鳋|鰣 鲥|鰤 𫚕|鰥 鳏|鰧 䲢|鰨 鳎|鰩 鳐|鰭 鳍|鰮 鳁|鰱 鲢|鰲 鳌|鰳 鳓|鰵 鳘|鰶 𬶭|鰷 鲦|鰹 鲣|鰺 鲹|鰻 鳗|鰼 鳛|鰾 鳔|鱀 𬶨|鱂 鳉|鱅 鳙|鱇 𩾌|鱈 鳕|鱉 鳖|鱒 鳟|鱔 鳝|鱖 鳜|鱗 鳞|鱘 鲟|鱚 𬶮|鱝 鲼|鱟 鲎|鱠 鲙|鱣 鳣|鱤 鳡|鱧 鳢|鱨 鲿|鱭 鲚|鱯 鳠|鱲 𫚭|鱷 鳄|鱸 鲈|鱺 鲡|鳥 鸟|鳧 凫|鳩 鸠|鳬 凫|鳲 鸤|鳳 凤|鳴 鸣|鳶 鸢|鳾 䴓|鴆 鸩|鴇 鸨|鴉 鸦|鴒 鸰|鴕 鸵|鴛 鸳|鴝 鸲|鴞 鸮|鴟 鸱|鴣 鸪|鴦 鸯|鴨 鸭|鴯 鸸|鴰 鸹|鴴 鸻|鴷 䴕|鴻 鸿|鴿 鸽|鵁 䴔|鵂 鸺|鵃 鸼|鵏 𬷕|鵐 鹀|鵑 鹃|鵒 鹆|鵓 鹁|鵜 鹈|鵝 鹅|鵟 𫛭|鵠 鹄|鵡 鹉|鵪 鹌|鵬 鹏|鵮 鹐|鵯 鹎|鵰 雕|鵲 鹊|鵷 鹓|鵾 鹍|鶄 䴖|鶇 鸫|鶉 鹑|鶊 鹒|鶓 鹋|鶖 鹙|鶘 鹕|鶚 鹗|鶠 𬸘|鶡 鹖|鶥 鹛|鶩 鹜|鶪 䴗|鶬 鸧|鶯 莺|鶱 𬸣|鶲 鹟|鶴 鹤|鶹 鹠|鶺 鹡|鶻 鹘|鶼 鹣|鶿 鹚|鷀 鹚|鷁 鹢|鷂 鹞|鷄 鸡|鷉 䴘|鷊 鹝|鷓 鹧|鷖 鹥|鷗 鸥|鷙 鸷|鷚 鹨|鷟 𬸦|鷥 鸶|鷦 鹪|鷫 鹔|鷭 𬸪|鷯 鹩|鷲 鹫|鷳 鹇|鷴 鹇|鷸 鹬|鷹 鹰|鷺 鹭|鷽 鸴|鸂 㶉|鸇 鹯|鸊 䴙|鸌 鹱|鸏 鹲|鸑 𬸚|鸕 鸬|鸘 鹴|鸚 鹦|鸛 鹳|鸝 鹂|鸞 鸾|鹵 卤|鹹 咸|鹺 鹾|鹼 碱|鹽 盐|麗 丽|麥 麦|麩 麸|麪 面|麫 面|麬 𤿲|麯 曲|麳 𪎌|麴 曲|麵 面|麼 么|麽 么|黃 黄|黌 黉|點 点|黨 党|黲 黪|黴 霉|黶 黡|黷 黩|黽 黾|黿 鼋|鼂 鼌|鼉 鼍|鼕 冬|鼴 鼹|齊 齐|齋 斋|齎 赍|齏 齑|齒 齿|齔 龀|齕 龁|齗 龂|齘 𬹼|齙 龅|齜 龇|齟 龃|齠 龆|齡 龄|齣 出|齦 龈|齧 啮|齪 龊|齬 龉|齮 𬺈|齯 𫠜|齲 龋|齶 腭|齷 龌|齼 𬺓|龍 龙|龎 厐|龐 庞|龑 䶮|龔 龚|龕 龛|龜 龟|鿁 䜤|鿓 鿒|𠁞 𠀾|𠌥 𠌥|𠏢 𠏢|𠐊 𠐊|𠗣 㓆|𠞆 𠞆|𠠎 𠠎|𠬙 𠬙|𠼤 𠼤|𠽃 𠽃|𠿕 𠿕|𡂡 𡂡|𡃄 𡃄|𡃕 𠴛|𡃤 𡃤|𡄔 𡄔|𡄣 𡄣|𡅏 𠲥|𡅯 𡅯|𡑍 𫭼|𡑭 𡋗|𡓁 𡓁|𡓾 𡋀|𡔖 𡍣|𡞵 㛟|𡟫 𡟫|𡠹 㛿|𡢃 㛠|𡮉 𡭜|𡮣 𡭬|𡳳 𡳃|𡸗 𡸗|𡹬 𡹬|𡻕 岁|𡽗 𡽗|𡾱 㟜|𡿖 𡿖|𢍰 𢍰|𢠼 𢠼|𢣐 𢣐|𢣚 𢘝|𢣭 𢣭|𢤩 𢤩|𢤱 𢤱|𢤿 𢤿|𢯷 𢯷|𢶒 𢶒|𢶫 𢫞|𢷮 𢷮|𢹿 𢬦|𢺳 𢺳|𣈶 暅|𣋋 𣋋|𣍐 𣍐|𣙎 㭣|𣜬 𣜬|𣝕 𣝕|𣞻 𣘓|𣠩 𣞎|𣠲 𣑶|𣯩 𣯩|𣯴 𣯴|𣯶 毶|𣽏 𣽏|𣾷 㳢|𣿉 𣿉|𤁣 𣺽|𤄷 𤄷|𤅶 𣷷|𤑳 𤑳|𤑹 𤑹|𤒎 𤒎|𤒻 𤒻|𤓌 𤓌|𤓎 𤓎|𤓩 𤊰|𤘀 𤘀|𤛮 𤛮|𤛱 𤛱|𤜆 𤜆|𤠮 𤠮|𤢟 𤢟|𤢻 𤢻|𤩂 𤩂|𤪺 㻘|𤫩 㻏|𤬅 𤬅|𤳷 𤳷|𤳸 𤳄|𤷃 𤷃|𤸫 𤸫|𤺔 𤺔|𥊝 𥅿|𥌃 𥅘|𥏝 𥏝|𥕥 𥐰|𥖅 𥐯|𥖲 𥖲|𥗇 𥗇|𥗽 𬒗|𥜐 𥜐|𥜰 𥜰|𥞵 𥞵|𥢢 䅪|𥢶 𥢶|𥢷 𥢷|𥨐 𥨐|𥪂 𥪂|𥯤 𥯤|𥴨 𥴨|𥴼 𥴼|𥵃 𥵃|𥵊 𥵊|𥶽 𥶽|𥸠 𥮋|𥻦 𥻦|𥼽 𥹥|𥽖 𥽖|𥾯 𥾯|𥿊 𥿊|𦀖 𦀖|𦂅 𦂅|𦃄 𦃄|𦃩 𦃩|𦅇 𦅇|𦅈 𦅈|𦆲 𦆲|𦒀 𦒀|𦔖 𦔖|𦘧 𡳒|𦟼 𦟼|𦠅 𦠅|𦡝 𦡝|𦢈 𦢈|𦣎 𦟗|𦧺 𦧺|𦪙 䑽|𦪽 𦪽|𦱌 𦱌|𦾟 𦾟|𧎈 𧎈|𧒯 𧒯|𧔥 𧔥|𧕟 𧕟|𧜗 䘞|𧜵 䙊|𧝞 䘛|𧞫 𧞫|𧟀 𧝧|𧡴 𧡴|𧢄 𧢄|𧦝 𧦝|𧦧 𧦧|𧩕 𧩕|𧩙 䜥|𧩼 𧩼|𧫝 𧫝|𧬤 𧬤|𧭈 𧭈|𧭹 𧭹|𧳟 𧳟|𧵳 䞌|𧶔 𧶔|𧶧 䞎|𧷎 𧷎|𧸘 𧸘|𧹈 𧹈|𧽯 𧽯|𨂐 𨂐|𨄣 𨄣|𨅍 𨅍|𨆪 𨆪|𨇁 𨇁|𨇞 𨇞|𨇤 𨇤|𨇰 𨇰|𨇽 𨇽|𨈊 𨈊|𨈌 𨈌|𨊰 䢀|𨊸 䢁|𨊻 𨊻|𨋢 䢂|𨌈 𨌈|𨍰 𨍰|𨎌 𨎌|𨎮 𨎮|𨏠 𨏠|𨏥 𨏥|𨞺 𨞺|𨟊 𨟊|𨢿 𨢿|𨣈 𨣈|𨣞 𨣞|𨣧 𨣧|𨤻 𨤰|𨥛 𨥛|𨥟 𨥟|𨦫 䦀|𨧀 𬭊|𨧜 䦁|𨧰 𨧰|𨧱 𨧱|𨨏 𬭛|𨨛 𨨛|𨨢 𨨢|𨩰 𨩰|𨪕 𨪕|𨫒 𨫒|𨬖 𨬖|𨭆 𬭶|𨭎 𬭳|𨭖 𨭖|𨭸 𨭸|𨮂 𨮂|𨮳 𨮳|𨯅 䥿|𨯟 𨯟|𨰃 𨰃|𨰋 𨰋|𨰥 𨰥|𨰲 𨰲|𨲳 𨲳|𨳑 𨳑|𨳕 𨳕|𨴗 𨴗|𨴹 𨴹|𨵩 𨵩|𨵸 𨵸|𨶀 𨶀|𨶏 𨶏|𨶮 𨶮|𨶲 𨶲|𨷲 𨷲|𨼳 𨼳|𨽏 𨽏|𩀨 𩀨|𩅙 𩅙|𩎖 𩎖|𩎢 𩎢|𩏂 𩏂|𩏠 𩏠|𩏪 𩏪|𩏷 𩏷|𩑔 𩑔|𩒎 𩒎|𩓣 𩓣|𩓥 𩓥|𩔑 𩔑|𩔳 𩔳|𩖰 𩖰|𩗀 𩗀|𩗓 𩗓|𩗴 𩗴|𩘀 𩘀|𩘝 𩘝|𩘹 𩘹|𩘺 𩘺|𩙈 𩙈|𩚛 𩚛|𩚥 𩚥|𩚩 𩚩|𩚵 𩚵|𩛆 𩛆|𩛌 𩛌|𩛡 𩛡|𩛩 𩛩|𩜇 𩜇|𩜦 𩜦|𩜵 𩜵|𩝔 𩝔|𩝽 𩝽|𩞄 𩞄|𩞦 𩞦|𩞯 䭪|𩟐 𩟐|𩟗 𩟗|𩠴 𩠠|𩡣 𩡣|𩡺 𩡺|𩢡 𩢡|𩢴 𩢴|𩢸 𩢸|𩢾 𩢾|𩣏 𩣏|𩣑 䯃|𩣫 𩣫|𩣵 𩣵|𩣺 𩣺|𩤊 𩤊|𩤙 𩤙|𩤲 𩤲|𩤸 𩤸|𩥄 𩥄|𩥇 𩥇|𩥉 𩥉|𩥑 𩥑|𩦠 𩦠|𩧆 𩧆|𩭙 𩭙|𩯁 𩯁|𩯳 𩯳|𩰀 𩰀|𩰹 𩰹|𩳤 𩳤|𩴵 𩴵|𩵦 𩵦|𩵩 𩵩|𩵹 𩵹|𩶁 𩶁|𩶘 䲞|𩶰 𩶰|𩶱 𩶱|𩷰 𩷰|𩸃 𩸃|𩸄 𩸄|𩸡 𩸡|𩸦 𩸦|𩻗 𩻗|𩻬 𩻬|𩻮 𩻮|𩼶 𩼶|𩽇 𩽇|𩿅 𩿅|𩿤 𩿤|𩿪 𩿪|𪀖 𪀖|𪀦 𪀦|𪀾 𪀾|𪁈 𪁈|𪁖 𪁖|𪂆 𪂆|𪃍 𪃍|𪃏 𪃏|𪃒 𪃒|𪃧 𪃧|𪄆 𪄆|𪄕 𪄕|𪅂 𪅂|𪆷 𪆷|𪇳 𪇳|𪈼 𪈼|𪉸 𪉸|𪋿 𪋿|𪌭 𪌭|𪍠 𪍠|𪓰 𪓰|𪔵 𪔵|𪘀 𪘀|𪘯 𪘯|𪙏 𪙏|𪟖 𪟖|𪷓 𪷓|𫒡 𫒡|𫜦 𫜦|𰻞 𰻝", v = "豈 豈|更 更|車 車|賈 賈|滑 滑|串 串|句 句|龜 龜|龜 龜|契 契|金 金|喇 喇|奈 奈|懶 懶|癩 癩|羅 羅|蘿 蘿|螺 螺|裸 裸|邏 邏|樂 樂|洛 洛|烙 烙|珞 珞|落 落|酪 酪|駱 駱|亂 亂|卵 卵|欄 欄|爛 爛|蘭 蘭|鸞 鸞|嵐 嵐|濫 濫|藍 藍|襤 襤|拉 拉|臘 臘|蠟 蠟|廊 廊|朗 朗|浪 浪|狼 狼|郎 郎|來 來|冷 冷|勞 勞|擄 擄|櫓 櫓|爐 爐|盧 盧|老 老|蘆 蘆|虜 虜|路 路|露 露|魯 魯|鷺 鷺|碌 碌|祿 祿|綠 綠|菉 菉|錄 錄|鹿 鹿|論 論|壟 壟|弄 弄|籠 籠|聾 聾|牢 牢|磊 磊|賂 賂|雷 雷|壘 壘|屢 屢|樓 樓|淚 淚|漏 漏|累 累|縷 縷|陋 陋|勒 勒|肋 肋|凜 凜|凌 凌|稜 稜|綾 綾|菱 菱|陵 陵|讀 讀|拏 拏|樂 樂|諾 諾|丹 丹|寧 寧|怒 怒|率 率|異 異|北 北|磻 磻|便 便|復 復|不 不|泌 泌|數 數|索 索|參 參|塞 塞|省 省|葉 葉|說 說|殺 殺|辰 辰|沈 沈|拾 拾|若 若|掠 掠|略 略|亮 亮|兩 兩|凉 凉|梁 梁|糧 糧|良 良|諒 諒|量 量|勵 勵|呂 呂|女 女|廬 廬|旅 旅|濾 濾|礪 礪|閭 閭|驪 驪|麗 麗|黎 黎|力 力|曆 曆|歷 歷|轢 轢|年 年|憐 憐|戀 戀|撚 撚|漣 漣|煉 煉|璉 璉|秊 秊|練 練|聯 聯|輦 輦|蓮 蓮|連 連|鍊 鍊|列 列|劣 劣|咽 咽|烈 烈|裂 裂|說 說|廉 廉|念 念|捻 捻|殮 殮|簾 簾|獵 獵|令 令|囹 囹|寧 寧|嶺 嶺|怜 怜|玲 玲|瑩 瑩|羚 羚|聆 聆|鈴 鈴|零 零|靈 靈|領 領|例 例|禮 禮|醴 醴|隸 隸|惡 惡|了 了|僚 僚|寮 寮|尿 尿|料 料|樂 樂|燎 燎|療 療|蓼 蓼|遼 遼|龍 龍|暈 暈|阮 阮|劉 劉|杻 杻|柳 柳|流 流|溜 溜|琉 琉|留 留|硫 硫|紐 紐|類 類|六 六|戮 戮|陸 陸|倫 倫|崙 崙|淪 淪|輪 輪|律 律|慄 慄|栗 栗|率 率|隆 隆|利 利|吏 吏|履 履|易 易|李 李|梨 梨|泥 泥|理 理|痢 痢|罹 罹|裏 裏|裡 裡|里 里|離 離|匿 匿|溺 溺|吝 吝|燐 燐|璘 璘|藺 藺|隣 隣|鱗 鱗|麟 麟|林 林|淋 淋|臨 臨|立 立|笠 笠|粒 粒|狀 狀|炙 炙|識 識|什 什|茶 茶|刺 刺|切 切|度 度|拓 拓|糖 糖|宅 宅|洞 洞|暴 暴|輻 輻|行 行|降 降|見 見|廓 廓|兀 兀|嗀 嗀|塚 塚|晴 晴|凞 凞|猪 猪|益 益|礼 礼|神 神|祥 祥|福 福|靖 靖|精 精|羽 羽|蘒 蘒|諸 諸|逸 逸|都 都|飯 飯|飼 飼|館 館|鶴 鶴|郞 郞|隷 隷|侮 侮|僧 僧|免 免|勉 勉|勤 勤|卑 卑|喝 喝|嘆 嘆|器 器|塀 塀|墨 墨|層 層|屮 屮|悔 悔|慨 慨|憎 憎|懲 懲|敏 敏|既 既|暑 暑|梅 梅|海 海|渚 渚|漢 漢|煮 煮|爫 爫|琢 琢|碑 碑|社 社|祉 祉|祈 祈|祐 祐|祖 祖|祝 祝|禍 禍|禎 禎|穀 穀|突 突|節 節|練 練|縉 縉|繁 繁|署 署|者 者|臭 臭|艹 艹|艹 艹|著 著|褐 褐|視 視|謁 謁|謹 謹|賓 賓|贈 贈|辶 辶|逸 逸|難 難|響 響|頻 頻|恵 恵|𤋮 𤋮|舘 舘|並 並|况 况|全 全|侀 侀|充 充|冀 冀|勇 勇|勺 勺|喝 喝|啕 啕|喙 喙|嗢 嗢|塚 塚|墳 墳|奄 奄|奔 奔|婢 婢|嬨 嬨|廒 廒|廙 廙|彩 彩|徭 徭|惘 惘|慎 慎|愈 愈|憎 憎|慠 慠|懲 懲|戴 戴|揄 揄|搜 搜|摒 摒|敖 敖|晴 晴|朗 朗|望 望|杖 杖|歹 歹|殺 殺|流 流|滛 滛|滋 滋|漢 漢|瀞 瀞|煮 煮|瞧 瞧|爵 爵|犯 犯|猪 猪|瑱 瑱|甆 甆|画 画|瘝 瘝|瘟 瘟|益 益|盛 盛|直 直|睊 睊|着 着|磌 磌|窱 窱|節 節|类 类|絛 絛|練 練|缾 缾|者 者|荒 荒|華 華|蝹 蝹|襁 襁|覆 覆|視 視|調 調|諸 諸|請 請|謁 謁|諾 諾|諭 諭|謹 謹|變 變|贈 贈|輸 輸|遲 遲|醙 醙|鉶 鉶|陼 陼|難 難|靖 靖|韛 韛|響 響|頋 頋|頻 頻|鬒 鬒|龜 龜|𢡊 𢡊|𢡄 𢡄|𣏕 𣏕|㮝 㮝|䀘 䀘|䀹 䀹|𥉉 𥉉|𥳐 𥳐|𧻓 𧻓|齃 齃|龎 龎|丽 丽|丸 丸|乁 乁|𠄢 𠄢|你 你|侮 侮|侻 侻|倂 倂|偺 偺|備 備|僧 僧|像 像|㒞 㒞|𠘺 𠘺|免 免|兔 兔|兤 兤|具 具|𠔜 𠔜|㒹 㒹|內 內|再 再|𠕋 𠕋|冗 冗|冤 冤|仌 仌|冬 冬|况 况|𩇟 𩇟|凵 凵|刃 刃|㓟 㓟|刻 刻|剆 剆|割 割|剷 剷|㔕 㔕|勇 勇|勉 勉|勤 勤|勺 勺|包 包|匆 匆|北 北|卉 卉|卑 卑|博 博|即 即|卽 卽|卿 卿|卿 卿|卿 卿|𠨬 𠨬|灰 灰|及 及|叟 叟|𠭣 𠭣|叫 叫|叱 叱|吆 吆|咞 咞|吸 吸|呈 呈|周 周|咢 咢|哶 哶|唐 唐|啓 啓|啣 啣|善 善|善 善|喙 喙|喫 喫|喳 喳|嗂 嗂|圖 圖|嘆 嘆|圗 圗|噑 噑|噴 噴|切 切|壮 壮|城 城|埴 埴|堍 堍|型 型|堲 堲|報 報|墬 墬|𡓤 𡓤|売 売|壷 壷|夆 夆|多 多|夢 夢|奢 奢|𡚨 𡚨|𡛪 𡛪|姬 姬|娛 娛|娧 娧|姘 姘|婦 婦|㛮 㛮|㛼 㛼|嬈 嬈|嬾 嬾|嬾 嬾|𡧈 𡧈|寃 寃|寘 寘|寧 寧|寳 寳|𡬘 𡬘|寿 寿|将 将|当 当|尢 尢|㞁 㞁|屠 屠|屮 屮|峀 峀|岍 岍|𡷤 𡷤|嵃 嵃|𡷦 𡷦|嵮 嵮|嵫 嵫|嵼 嵼|巡 巡|巢 巢|㠯 㠯|巽 巽|帨 帨|帽 帽|幩 幩|㡢 㡢|𢆃 𢆃|㡼 㡼|庰 庰|庳 庳|庶 庶|廊 廊|𪎒 𪎒|廾 廾|𢌱 𢌱|𢌱 𢌱|舁 舁|弢 弢|弢 弢|㣇 㣇|𣊸 𣊸|𦇚 𦇚|形 形|彫 彫|㣣 㣣|徚 徚|忍 忍|志 志|忹 忹|悁 悁|㤺 㤺|㤜 㤜|悔 悔|𢛔 𢛔|惇 惇|慈 慈|慌 慌|慎 慎|慌 慌|慺 慺|憎 憎|憲 憲|憤 憤|憯 憯|懞 懞|懲 懲|懶 懶|成 成|戛 戛|扝 扝|抱 抱|拔 拔|捐 捐|𢬌 𢬌|挽 挽|拼 拼|捨 捨|掃 掃|揤 揤|𢯱 𢯱|搢 搢|揅 揅|掩 掩|㨮 㨮|摩 摩|摾 摾|撝 撝|摷 摷|㩬 㩬|敏 敏|敬 敬|𣀊 𣀊|旣 旣|書 書|晉 晉|㬙 㬙|暑 暑|㬈 㬈|㫤 㫤|冒 冒|冕 冕|最 最|暜 暜|肭 肭|䏙 䏙|朗 朗|望 望|朡 朡|杞 杞|杓 杓|𣏃 𣏃|㭉 㭉|柺 柺|枅 枅|桒 桒|梅 梅|𣑭 𣑭|梎 梎|栟 栟|椔 椔|㮝 㮝|楂 楂|榣 榣|槪 槪|檨 檨|𣚣 𣚣|櫛 櫛|㰘 㰘|次 次|𣢧 𣢧|歔 歔|㱎 㱎|歲 歲|殟 殟|殺 殺|殻 殻|𣪍 𣪍|𡴋 𡴋|𣫺 𣫺|汎 汎|𣲼 𣲼|沿 沿|泍 泍|汧 汧|洖 洖|派 派|海 海|流 流|浩 浩|浸 浸|涅 涅|𣴞 𣴞|洴 洴|港 港|湮 湮|㴳 㴳|滋 滋|滇 滇|𣻑 𣻑|淹 淹|潮 潮|𣽞 𣽞|𣾎 𣾎|濆 濆|瀹 瀹|瀞 瀞|瀛 瀛|㶖 㶖|灊 灊|災 災|灷 灷|炭 炭|𠔥 𠔥|煅 煅|𤉣 𤉣|熜 熜|𤎫 𤎫|爨 爨|爵 爵|牐 牐|𤘈 𤘈|犀 犀|犕 犕|𤜵 𤜵|𤠔 𤠔|獺 獺|王 王|㺬 㺬|玥 玥|㺸 㺸|㺸 㺸|瑇 瑇|瑜 瑜|瑱 瑱|璅 璅|瓊 瓊|㼛 㼛|甤 甤|𤰶 𤰶|甾 甾|𤲒 𤲒|異 異|𢆟 𢆟|瘐 瘐|𤾡 𤾡|𤾸 𤾸|𥁄 𥁄|㿼 㿼|䀈 䀈|直 直|𥃳 𥃳|𥃲 𥃲|𥄙 𥄙|𥄳 𥄳|眞 眞|真 真|真 真|睊 睊|䀹 䀹|瞋 瞋|䁆 䁆|䂖 䂖|𥐝 𥐝|硎 硎|碌 碌|磌 磌|䃣 䃣|𥘦 𥘦|祖 祖|𥚚 𥚚|𥛅 𥛅|福 福|秫 秫|䄯 䄯|穀 穀|穊 穊|穏 穏|𥥼 𥥼|𥪧 𥪧|𥪧 𥪧|竮 竮|䈂 䈂|𥮫 𥮫|篆 篆|築 築|䈧 䈧|𥲀 𥲀|糒 糒|䊠 䊠|糨 糨|糣 糣|紀 紀|𥾆 𥾆|絣 絣|䌁 䌁|緇 緇|縂 縂|繅 繅|䌴 䌴|𦈨 𦈨|𦉇 𦉇|䍙 䍙|𦋙 𦋙|罺 罺|𦌾 𦌾|羕 羕|翺 翺|者 者|𦓚 𦓚|𦔣 𦔣|聠 聠|𦖨 𦖨|聰 聰|𣍟 𣍟|䏕 䏕|育 育|脃 脃|䐋 䐋|脾 脾|媵 媵|𦞧 𦞧|𦞵 𦞵|𣎓 𣎓|𣎜 𣎜|舁 舁|舄 舄|辞 辞|䑫 䑫|芑 芑|芋 芋|芝 芝|劳 劳|花 花|芳 芳|芽 芽|苦 苦|𦬼 𦬼|若 若|茝 茝|荣 荣|莭 莭|茣 茣|莽 莽|菧 菧|著 著|荓 荓|菊 菊|菌 菌|菜 菜|𦰶 𦰶|𦵫 𦵫|𦳕 𦳕|䔫 䔫|蓱 蓱|蓳 蓳|蔖 蔖|𧏊 𧏊|蕤 蕤|𦼬 𦼬|䕝 䕝|䕡 䕡|𦾱 𦾱|𧃒 𧃒|䕫 䕫|虐 虐|虜 虜|虧 虧|虩 虩|蚩 蚩|蚈 蚈|蜎 蜎|蛢 蛢|蝹 蝹|蜨 蜨|蝫 蝫|螆 螆|䗗 䗗|蟡 蟡|蠁 蠁|䗹 䗹|衠 衠|衣 衣|𧙧 𧙧|裗 裗|裞 裞|䘵 䘵|裺 裺|㒻 㒻|𧢮 𧢮|𧥦 𧥦|䚾 䚾|䛇 䛇|誠 誠|諭 諭|變 變|豕 豕|𧲨 𧲨|貫 貫|賁 賁|贛 贛|起 起|𧼯 𧼯|𠠄 𠠄|跋 跋|趼 趼|跰 跰|𠣞 𠣞|軔 軔|輸 輸|𨗒 𨗒|𨗭 𨗭|邔 邔|郱 郱|鄑 鄑|𨜮 𨜮|鄛 鄛|鈸 鈸|鋗 鋗|鋘 鋘|鉼 鉼|鏹 鏹|鐕 鐕|𨯺 𨯺|開 開|䦕 䦕|閷 閷|𨵷 𨵷|䧦 䧦|雃 雃|嶲 嶲|霣 霣|𩅅 𩅅|𩈚 𩈚|䩮 䩮|䩶 䩶|韠 韠|𩐊 𩐊|䪲 䪲|𩒖 𩒖|頋 頋|頋 頋|頩 頩|𩖶 𩖶|飢 飢|䬳 䬳|餩 餩|馧 馧|駂 駂|駾 駾|䯎 䯎|𩬰 𩬰|鬒 鬒|鱀 鱀|鳽 鳽|䳎 䳎|䳭 䳭|鵧 鵧|𪃎 𪃎|䳸 䳸|𪄅 𪄅|𪈎 𪈎|𪊑 𪊑|麻 麻|䵖 䵖|黹 黹|黾 黾|鼅 鼅|鼏 鼏|鼖 鼖|鼻 鼻|𪘀 𪘀";
var N = Object.freeze({
	__proto__: null,
	configs: {
		hk2s: {
			normalizationChain: [[v]],
			segmentation: [y],
			conversionChain: [[u, g], [y, m]]
		},
		hk2sp: {
			normalizationChain: [[v]],
			segmentation: [y],
			conversionChain: [[
				f,
				u,
				g
			], [y, m]]
		},
		t2s: {
			normalizationChain: [[v]],
			conversionChain: [[y, m]]
		},
		tw2s: {
			normalizationChain: [[v]],
			segmentation: [y],
			conversionChain: [[d, h], [y, m]]
		},
		tw2sp: {
			normalizationChain: [[v]],
			segmentation: [y],
			conversionChain: [[
				p,
				d,
				h
			], [y, m]]
		}
	},
	from: {
		hk: [[u, g]],
		hkp: [[
			f,
			u,
			g
		]],
		tw: [[d, h]],
		twp: [[
			p,
			d,
			h
		]],
		jp: [["一獲千金 一攫千金|丁寧 叮嚀|丁重 鄭重|三差路 三叉路|世論 輿論|予備 預備|予告 預告|予定 預定|予感 預感|予測 預測|予算 預算|予約 預約|予習 預習|予言 預言|予防 預防|亜鈴 啞鈴|交差 交叉|代弁 代辯|供宴 饗宴|俊馬 駿馬|保塁 堡壘|個条書 箇条書|偏平 扁平|停泊 碇泊|優俊 優駿|先兵 尖兵|先端 尖端|先鋭 尖銳|共役 共軛|冗舌 饒舌|凶器 兇器|削岩 鑿岩|包丁 庖丁|包帯 繃帶|区画 區劃|厳然 儼然|友宜 友誼|反乱 叛亂|収集 蒐集|叙情 抒情|台頭 擡頭|合弁 合辦|喜遊曲 嬉遊曲|嘆願 歎願|回転 廻転|回遊 回游|国際連盟 國際聯盟|奉持 捧持|委縮 萎縮|安全弁 安全瓣|展転 輾轉|希少 稀少|幻惑 眩惑|広範 廣泛|広野 曠野|廃虚 廢墟|建坪率 建蔽率|弁別 辨別|弁当 辨當|弁才 辯才|弁明 辯明|弁膜 瓣膜|弁解 辯解|弁証 辯證|弁論 辯論|弁論家 辯論家|弁護 辯護|弁護士 辯護士|弁財天 辯財天|弁駁 辯駁|弁髪 辮髮|弦歌 絃歌|恩義 恩誼|意向 意嚮|慰謝料 慰藉料|憶断 臆斷|憶病 臆病|戦没 戰歿|扇情 煽情|手帳 手帖|技量 伎倆|抜粋 抜萃|披歴 披瀝|抵触 牴觸|抽選 抽籤|拘引 勾引|拠出 醵出|拠金 醵金|掘削 掘鑿|控除 扣除|援護 掩護|放棄 抛棄|散水 撒水|敬謙 敬虔|敷延 敷衍|断固 斷乎|族生 簇生|昇叙 陞敘|暖房 煖房|暗唱 暗誦|暗夜 闇夜|暴露 曝露|枯渇 涸渴|格好 恰好|格幅 恰幅|棄損 毀損|模索 摸索|橋頭保 橋頭堡|欠缺 欠缺|欧州 歐洲|欧州連合 歐洲聯盟|死体 屍體|殿部 臀部|母指 拇指|気迫 氣魄|決別 訣別|決壊 決潰|沈殿 沈澱|油送船 油槽船|波乱 波瀾|注釈 註釋|洗浄 洗滌|活発 活潑|浸透 滲透|浸食 浸蝕|消却 銷卻|混然 渾然|湾曲 彎曲|溶接 熔接|漁労 漁撈|漂然 飄然|激高 激昂|火炎 火焰|焦燥 焦躁|猶予 猶豫|班点 斑點|留飲 溜飲|略奪 掠奪|疎通 疏通|発酵 醱酵|白亜 白堊|相克 相剋|知恵 智慧|破棄 破毀|確固 確乎|禁固 禁錮|符丁 符牒|粉装 扮裝|紫班 紫斑|終息 終熄|総合 綜合|編集 編輯|義援 義捐|耕運機 耕耘機|肝心 肝腎|肩甲骨 肩胛骨|背徳 悖德|脈拍 脈搏|膨張 膨脹|花弁 花瓣|芳純 芳醇|英知 叡智|蒸留 蒸溜|薫蒸 燻蒸|薫製 燻製|衣装 衣裳|衰退 衰退|裕然 悠然|補佐 輔佐|訓戒 訓誡|試練 試煉|詭弁 詭辯|講和 媾和|象眼 象嵌|貫録 貫祿|買弁 買辦|賛辞 讚辭|踏襲 蹈襲|車両 車輛|転倒 顛倒|輪郭 輪廓|退色 褪色|途絶 杜絕|連係 連繫|連合 聯合|連合会 聯合會|連合国 聯合國|連合艦隊 聯合艦隊|連合軍 聯合軍|連名 聯名|連想 聯想|連携 聯攜|連盟 聯盟|連立 聯立|連結 聯結|連結器 聯結器|連結性 聯結性|連絡 聯絡|連絡員 聯絡員|連絡網 聯絡網|連絡線 聯絡線|連絡船 聯絡船|連邦 聯邦|連邦共和国 聯邦共和國|連邦制 聯邦制|連邦国 聯邦國|連邦国家 聯邦國家|連邦政府 聯邦政府|連邦議会 聯邦議會|連邦軍 聯邦軍|連隊 聯隊|選考 銓衡|酢酸 醋酸|野卑 野鄙|鉱石 礦石|間欠 間歇|関数 函數|関連 關聯|関連図 關聯圖|関連性 關聯性|関連語 關聯語|防御 防禦|険阻 嶮岨|障壁 牆壁|障害 障礙|隠滅 湮滅|雄弁 雄辯|集落 聚落|雇用 僱傭|風諭 諷喩|飛語 蜚語|香典 香奠|骨格 骨骼|高進 亢進|鳥観 鳥瞰", "万 萬|与 與|両 兩|並 竝|乗 乘|乱 亂|亀 龜|予 豫|争 爭|亘 亙|亜 亞|仏 佛|仮 假|会 會|伝 傳|体 體|余 餘|併 倂|価 價|倹 儉|偽 僞|児 兒|党 黨|円 圓|写 寫|凜 凛|処 處|剣 劍|剤 劑|剰 剩|励 勵|労 勞|効 效|勅 敕|勧 勸|勲 勳|区 區|医 醫|単 單|即 卽|厳 嚴|参 參|双 雙|収 收|叙 敍|台 臺|号 號|唖 啞|営 營|嘱 囑|噛 嚙|団 團|囲 圍|図 圖|国 國|圏 圈|圧 壓|堕 墮|塁 壘|塩 鹽|増 增|壊 壞|壌 壤|壮 壯|声 聲|壱 壹|売 賣|変 變|奥 奧|奨 奬|嬢 孃|学 學|宝 寶|実 實|寛 寬|寝 寢|対 對|寿 壽|専 專|将 將|尭 堯|尽 盡|届 屆|属 屬|岳 嶽|峡 峽|巌 巖|巣 巢|巻 卷|帯 帶|帰 歸|庁 廳|広 廣|廃 廢|弁 辨|弐 貳|弥 彌|弯 彎|弾 彈|当 當|径 徑|従 從|徳 德|徴 徵|応 應|恋 戀|恒 恆|恵 惠|悩 惱|悪 惡|惨 慘|慎 愼|懐 懷|戦 戰|戯 戲|戻 戾|払 拂|抜 拔|択 擇|担 擔|拝 拜|拠 據|拡 擴|挙 擧|挟 挾|挿 插|捜 搜|掲 揭|掻 搔|揺 搖|摂 攝|撃 擊|撹 攪|数 數|斉 齊|斎 齋|断 斷|旧 舊|昼 晝|晃 晄|晩 晚|暁 曉|暦 曆|曽 曾|条 條|来 來|枢 樞|栄 榮|桜 櫻|桝 枡|桟 棧|桧 檜|検 檢|楼 樓|楽 樂|概 槪|様 樣|槙 槇|権 權|横 橫|欠 缺|欧 歐|歓 歡|歩 步|歯 齒|歳 歲|歴 歷|残 殘|殴 毆|殻 殼|毎 每|気 氣|沢 澤|沪 濾|浄 淨|浅 淺|浜 濱|涙 淚|渇 渴|済 濟|渉 涉|渋 澁|渓 溪|温 溫|湾 灣|湿 濕|満 滿|滝 瀧|滞 滯|潜 潛|瀬 瀨|灯 燈|炉 爐|点 點|為 爲|焼 燒|犠 犧|状 狀|独 獨|狭 狹|猟 獵|献 獻|獣 獸|瓶 甁|画 畫|畳 疊|痩 瘦|痴 癡|発 發|盗 盜|県 縣|真 眞|研 硏|砕 碎|礼 禮|祢 禰|祷 禱|禄 祿|禅 禪|秘 祕|称 稱|稲 稻|穂 穗|穏 穩|穣 穰|窃 竊|竜 龍|粋 粹|粛 肅|糸 絲|経 經|絵 繪|継 繼|続 續|総 總|緑 綠|緒 緖|縁 緣|縄 繩|縦 縱|繊 纖|繍 繡|缶 罐|翻 飜|聴 聽|胆 膽|脚 腳|脱 脫|脳 腦|臓 臟|艶 艷|芦 蘆|芸 藝|茎 莖|荘 莊|萌 萠|蒋 蔣|蔵 藏|薫 薰|薬 藥|虚 虛|虫 蟲|蚕 蠶|蛍 螢|蛮 蠻|蝋 蠟|衛 衞|装 裝|褒 襃|覇 霸|覚 覺|覧 覽|観 觀|触 觸|訳 譯|証 證|誉 譽|説 說|読 讀|謡 謠|譲 讓|豊 豐|賛 贊|践 踐|転 轉|軽 輕|辞 辭|辺 邊|逓 遞|遅 遲|遥 遙|郎 郞|郷 鄕|酔 醉|醤 醬|醸 釀|釈 釋|鉄 鐵|鉱 鑛|銭 錢|鋳 鑄|錬 鍊|録 錄|鎮 鎭|関 關|閲 閱|闘 鬭|陥 陷|険 險|随 隨|隠 隱|雑 雜|霊 靈|静 靜|頴 穎|頼 賴|顔 顏|顕 顯|餅 餠|駅 驛|駆 驅|騒 騷|験 驗|髄 髓|髪 髮|鴎 鷗|鶏 鷄|鹸 鹼|麦 麥|麹 麴|麺 麵|黄 黃|黒 黑|黙 默|齢 齡"]]
	},
	to: { cn: [[y, m]] }
});
const w = (T = N, function(t) {
	if (["from", "to"].forEach((n) => {
		if (!t || "string" != typeof t[n]) throw new Error("Please provide the `" + n + "` option");
		if ("t" !== t[n] && !T[n][t[n]]) throw new Error("Unknown `" + n + "` locale: " + t[n]);
	}), T.configs) {
		const i = T.configs[e = t.from, r = t.to, "cn" === e ? `s2${r}` : "cn" === r ? "hkp" === e ? "hk2sp" : "twp" === e ? "tw2sp" : `${e}2s` : `${e}2${r}`];
		if (i) {
			const t = function(t, ...e) {
				let r = null;
				t && (r = new n(), Array.isArray(t) && t.every((n) => "string" == typeof n) ? r.loadDictGroup(t) : r.loadDict(t));
				const o = e.map((t) => {
					const e = new n();
					return e.loadDictGroup(t), e;
				});
				return function(n) {
					const t = r ? r.segment(n) : [n];
					return o.reduce((n, t) => n.map((n) => t.convert(n)), t).join("");
				};
			}(i.segmentation, ...i.conversionChain);
			if (!i.normalizationChain) return t;
			const e = o(...i.normalizationChain);
			return function(n) {
				return t(e(n));
			};
		}
	}
	var e, r;
	let i = [];
	return ["from", "to"].forEach((n) => {
		var e;
		"t" !== t[n] && i.push(...(e = T[n][t[n]], Array.isArray(e) && Array.isArray(e[0]) ? e : [e]));
	}), o.apply(null, i);
});
var T;

//#endregion
//#region .build-temp/src/cjk.ts
const hkToCn = w({
	from: "hk",
	to: "cn"
});
/**
* 将香港繁体文本归一化为简体（仅用于搜索/匹配，不用于展示）。
* - 英文/数字/符号原样保留
* - 简体输入或空字符串安全返回
*/
function normalizeCjk(text) {
	if (!text) return "";
	return hkToCn(text);
}

//#endregion
//#region .build-temp/src/config.ts
/** 缓存有效期（毫秒）；null = 不缓存（实时接口） */
const TTL_MS = {
	realtime: null,
	weekly: 720 * 60 * 1e3,
	termly: 10080 * 60 * 1e3,
	yearly: 720 * 60 * 60 * 1e3
};
/**
* 判断缓存年龄是否仍在有效期内。
* realtime 策略永不判为新鲜（调用方不缓存）。
*/
function isFresh(refresh, ageMs) {
	const ttl = TTL_MS[refresh];
	if (ttl === null) return false;
	return ageMs < ttl;
}
/** 附近学校实时接口（不缓存，每次实时调用；参数 lat/long/max） */
const NEAREST_SCHOOLS_API = "https://api.data.gov.hk/v1/nearest-schools";
const EDB_XML = "https://applications.edb.gov.hk/datagovhk/data/";
/** 全部可缓存文件源（16 个）：12 CSV + 3 XML + 1 XLSX；实时接口见 NEAREST_SCHOOLS_API */
const SOURCES = [
	{
		id: "sch_loc",
		url: "https://www.edb.gov.hk/attachment/datagovhk/SCH_LOC_EDB.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: "	",
		note: "学校位置总表（约 3,461 所；UTF-16 LE/Tab；坐标 DMS 度-分-秒）"
	},
	{
		id: "kgp",
		url: "http://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/free-quality-kg-edu/KGP_2025_tc.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: "^",
		note: "幼稚园概览 2025（962 所；UTF-8 BOM/^分隔）"
	},
	{
		id: "psp",
		url: "https://www.chsc.hk/datagovhk/psp_2025_tc.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: ",",
		note: "小学概览 2025（521 所；UTF-8 BOM）"
	},
	{
		id: "ssp",
		url: "https://www.chsc.hk/datagovhk/ssp_2025_2026_tc.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: ",",
		note: "中学概览 2025/26（UTF-8 BOM）"
	},
	{
		id: "through_train",
		url: "https://www.edb.gov.hk/attachment/datagovhk/Through-train-schools-tc.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: ",",
		note: "一条龙学校名单 2026/27"
	},
	{
		id: "poa",
		url: "https://www.edb.gov.hk/attachment/datagovhk/POA_SchoolNet_TC.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: ",",
		note: "小一入学学校网范围（全港校网）"
	},
	{
		id: "sspa",
		url: "https://www.edb.gov.hk/attachment/datagovhk/SSPA_SchServingNet_tc.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: ",",
		note: "中学学位分配校网（UTF-8 BOM；18 个校网列 Y/N）"
	},
	{
		id: "k1_not_joining",
		url: "http://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/kindergartens_not_joining_scheme_tc_2026.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: ",",
		note: "不参加免费幼教计划的幼稚园名单 2026/27"
	},
	{
		id: "k1k3_vacancy",
		url: "http://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/kindergarten-k1-admission-arrangements/K1-K3_vacancy_information_tc_202627.csv",
		refresh: "weekly",
		format: "csv",
		delimiter: ",",
		note: "K1–K3 学位空缺（每周更新；按 18 区）"
	},
	{
		id: "kg_scheme",
		url: "http://www.edb.gov.hk/attachment/tc/edu-system/preprimary-kindergarten/free-quality-kg-edu/scheme_kg_list_202526_tc-en.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: "	",
		note: "免费优质幼稚园教育计划名单 2025/26（UTF-16 LE/Tab；表头引号内嵌换行）"
	},
	{
		id: "dss_fee",
		url: "https://www.edb.gov.hk/attachment/datagovhk/DSS_School_Fee_TC.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: ",",
		note: "直资学校学费 2025/26"
	},
	{
		id: "non_aided_ccc",
		url: "https://www.edb.gov.hk/attachment/datagovhk/Non-aided_CCCs_attached_to_KGs_tc.csv",
		refresh: "yearly",
		format: "csv",
		delimiter: ",",
		note: "附设于幼稚园的非资助幼儿中心（UTF-16 LE）"
	},
	{
		id: "reg_basic",
		url: `${EDB_XML}SchoolBasicInfo.xml`,
		refresh: "termly",
		format: "xml",
		delimiter: "",
		note: "学校注册资料·基本信息（12,159 条；注册编号/状况/类别；约 20MB）"
	},
	{
		id: "reg_premises",
		url: `${EDB_XML}SchoolPremises.xml`,
		refresh: "termly",
		format: "xml",
		delimiter: "",
		note: "学校注册资料·校舍（5,837 条；校舍地址；约 12MB）"
	},
	{
		id: "reg_accommodation",
		url: `${EDB_XML}SchoolAccommodation.xml`,
		refresh: "termly",
		format: "xml",
		delimiter: "",
		note: "学校注册资料·批准容额（43,273 间课室；约 115MB）"
	},
	{
		id: "tab0407",
		url: "https://www.edb.gov.hk/attachment/tc/about-edb/publications-stat/figures/Statistics_by_district_C.xlsx",
		refresh: "yearly",
		format: "xlsx",
		delimiter: "",
		note: "中学日校分区学生人数（官方 XLSX「表3(b)」總計·學生人數列；2026-09-17 实测，随学年覆盖更新）"
	}
];
/** 按 id 取数据源；未注册时抛内部错误（开发期暴露拼写问题） */
function getSource(id) {
	const found = SOURCES.find((s) => s.id === id);
	if (!found) throw new Error(`内部错误：未注册的数据源「${id}」`);
	return found;
}

//#endregion
//#region .build-temp/src/decode.ts
const utf8Decoder = new TextDecoder("utf-8", { fatal: false });
const utf16leDecoder = new TextDecoder("utf-16le", { fatal: false });
/**
* 将原始字节解码为文本。
* - `FF FE` 开头 → UTF-16 LE（去 BOM）
* - `EF BB BF` 开头 → UTF-8（去 BOM）
* - 其余 → UTF-8；坏字节以替换字符（U+FFFD）容错，不抛异常
*/
function decodeBytes(buf) {
	if (buf.length === 0) return "";
	if (buf.length >= 2 && buf[0] === 255 && buf[1] === 254) return utf16leDecoder.decode(buf.subarray(2));
	if (buf.length >= 3 && buf[0] === 239 && buf[1] === 187 && buf[2] === 191) return utf8Decoder.decode(buf.subarray(3));
	return utf8Decoder.decode(buf);
}

//#endregion
//#region .build-temp/src/fetcher.ts
const DEFAULT_TIMEOUT_MS = 12e4;
/** 默认下载实现：Node 原生 fetch + 超时保护（大文件 3–20MB） */
async function defaultFetchBytes(url) {
	const res = await fetch(url, {
		redirect: "follow",
		signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return new Uint8Array(await res.arrayBuffer());
}
function createFetcher(options) {
	const { cacheDir } = options;
	const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
	const now = options.now ?? Date.now;
	/** 并发合流：同一源进行中的请求仅保留一个 */
	const inFlight = /* @__PURE__ */ new Map();
	const rawPath = (id) => join(cacheDir, `${id}.raw`);
	const metaPath = (id) => join(cacheDir, `${id}.meta.json`);
	/** 读缓存：.raw 存在即有效；meta 缺失/损坏视为很旧（fetchedAt=0） */
	function readCache(source) {
		try {
			const p = rawPath(source.id);
			if (!existsSync(p)) return void 0;
			let fetchedAt = 0;
			try {
				const meta = JSON.parse(readFileSync(metaPath(source.id), "utf8"));
				if (typeof meta.fetchedAt === "number") fetchedAt = meta.fetchedAt;
			} catch {}
			return {
				data: readFileSync(p),
				fetchedAt
			};
		} catch {
			return;
		}
	}
	/** 写缓存（失败不阻塞本次查询，仅影响下次缓存命中） */
	function writeCache(source, data, fetchedAt) {
		try {
			mkdirSync(cacheDir, { recursive: true });
			writeFileSync(rawPath(source.id), data);
			writeFileSync(metaPath(source.id), JSON.stringify({
				id: source.id,
				url: source.url,
				fetchedAt
			}));
		} catch {}
	}
	async function doGet(source) {
		const cached = source.refresh === "realtime" ? void 0 : readCache(source);
		if (cached && cached.fetchedAt > 0 && isFresh(source.refresh, now() - cached.fetchedAt)) return {
			data: cached.data,
			fromCache: true,
			stale: false,
			fetchedAt: cached.fetchedAt
		};
		try {
			const data = await fetchBytes(source.url);
			const fetchedAt = now();
			if (source.refresh !== "realtime") writeCache(source, data, fetchedAt);
			return {
				data,
				fromCache: false,
				stale: false,
				fetchedAt
			};
		} catch (err) {
			if (cached) return {
				data: cached.data,
				fromCache: true,
				stale: true,
				fetchedAt: cached.fetchedAt
			};
			throw new Error(`香港学校数据（${source.note}）暂时无法下载，且本地暂无缓存。请稍后重试，或访问教育局官网查询。`, { cause: err });
		}
	}
	return { get(source) {
		const existing = inFlight.get(source.id);
		if (existing) return existing;
		const p = doGet(source);
		inFlight.set(source.id, p);
		const cleanup = () => {
			if (inFlight.get(source.id) === p) inFlight.delete(source.id);
		};
		p.then(cleanup, cleanup);
		return p;
	} };
}

//#endregion
//#region .build-temp/src/csv.ts
/**
* 将 CSV 文本解析为二维字符串数组。
* - 支持引号字段（`"` 包裹）、引号内换行、`""` 转义
* - 支持 \n / \r\n / \r 行尾；跳过纯空行
*/
function parseCsv(text, options = {}) {
	const delimiter = options.delimiter ?? ",";
	const rows = [];
	let row = [];
	let field = "";
	let inQuotes = false;
	let i = text.charCodeAt(0) === 65279 ? 1 : 0;
	for (; i < text.length; i++) {
		const ch = text[i];
		if (inQuotes) if (ch === "\"") if (text[i + 1] === "\"") {
			field += "\"";
			i++;
		} else inQuotes = false;
		else field += ch;
		else if (ch === "\"" && field === "") inQuotes = true;
		else if (ch === delimiter) {
			row.push(field);
			field = "";
		} else if (ch === "\n" || ch === "\r") {
			if (ch === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			field = "";
			rows.push(row);
			row = [];
		} else field += ch;
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
/**
* 解析为对象数组：首行作表头（自动 trim），空表头列忽略。
* 数据行字段数少于表头时，缺失字段不出现在对象中。
*/
function parseCsvToObjects(text, options = {}) {
	const rows = parseCsv(text, options);
	if (rows.length === 0) return [];
	const header = rows[0].map((h) => h.trim());
	const objects = [];
	for (let i = 1; i < rows.length; i++) {
		const obj = {};
		for (let j = 0; j < header.length; j++) {
			const key = header[j];
			if (key === "") continue;
			const val = rows[i][j];
			if (val !== void 0) obj[key] = val;
		}
		objects.push(obj);
	}
	return objects;
}

//#endregion
//#region .build-temp/src/districts.ts
const DISTRICTS = [
	{
		en: "CENTRAL AND WESTERN",
		zh: "中西区"
	},
	{
		en: "WAN CHAI",
		zh: "湾仔区"
	},
	{
		en: "EASTERN",
		zh: "东区"
	},
	{
		en: "SOUTHERN",
		zh: "南区"
	},
	{
		en: "YAU TSIM MONG",
		zh: "油尖旺区"
	},
	{
		en: "SHAM SHUI PO",
		zh: "深水埗区"
	},
	{
		en: "KOWLOON CITY",
		zh: "九龙城区"
	},
	{
		en: "WONG TAI SIN",
		zh: "黄大仙区"
	},
	{
		en: "KWUN TONG",
		zh: "观塘区"
	},
	{
		en: "KWAI TSING",
		zh: "葵青区"
	},
	{
		en: "TSUEN WAN",
		zh: "荃湾区"
	},
	{
		en: "TUEN MUN",
		zh: "屯门区"
	},
	{
		en: "YUEN LONG",
		zh: "元朗区"
	},
	{
		en: "NORTH",
		zh: "北区"
	},
	{
		en: "TAI PO",
		zh: "大埔区"
	},
	{
		en: "SHA TIN",
		zh: "沙田区"
	},
	{
		en: "SAI KUNG",
		zh: "西贡区"
	},
	{
		en: "ISLANDS",
		zh: "离岛区"
	}
];
/**
* 解析区域名：
* - 英文大小写不敏感；繁体自动转简；可省略「区」字
* - 无法识别返回 undefined
*/
function resolveDistrict(input) {
	const s = normalizeCjk((input ?? "").trim());
	if (!s) return void 0;
	const upper = s.toUpperCase();
	return DISTRICTS.find((d) => d.en === upper) ?? DISTRICTS.find((d) => d.zh === s || d.zh === `${s}区`);
}

//#endregion
//#region .build-temp/src/xlsx.ts
const EOCD_SIG = 101010256;
const CEN_SIG = 33639248;
const LOC_SIG = 67324752;
/** 在文件末尾扫描 End of Central Directory（兼容 ZIP 注释，最长 65557 字节） */
function findEocd(buf) {
	const min = Math.max(0, buf.length - 65557);
	for (let i = buf.length - 22; i >= min; i--) if (buf.readUInt32LE(i) === EOCD_SIG) return i;
	throw new Error("无法解析 XLSX 文件：未找到 ZIP 目录（不是有效的 Excel 文档）。");
}
/** 解出 ZIP 全部条目（name → 解压内容；支持 stored / deflate 两种压缩方式） */
function readZipEntries(buf) {
	const eocd = findEocd(buf);
	const count = buf.readUInt16LE(eocd + 10);
	let ptr = buf.readUInt32LE(eocd + 16);
	const entries = /* @__PURE__ */ new Map();
	for (let n = 0; n < count; n++) {
		if (buf.readUInt32LE(ptr) !== CEN_SIG) throw new Error("无法解析 XLSX 文件：ZIP 目录损坏。");
		const method = buf.readUInt16LE(ptr + 10);
		const compressedSize = buf.readUInt32LE(ptr + 20);
		const nameLen = buf.readUInt16LE(ptr + 28);
		const extraLen = buf.readUInt16LE(ptr + 30);
		const commentLen = buf.readUInt16LE(ptr + 32);
		const localOffset = buf.readUInt32LE(ptr + 42);
		const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);
		if (buf.readUInt32LE(localOffset) !== LOC_SIG) throw new Error("无法解析 XLSX 文件：ZIP 条目损坏。");
		const dataStart = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
		const raw = buf.subarray(dataStart, dataStart + compressedSize);
		if (method === 0) entries.set(name, Buffer.from(raw));
		else if (method === 8) entries.set(name, inflateRawSync(raw));
		ptr += 46 + nameLen + extraLen + commentLen;
	}
	return entries;
}
const XML_ENTITIES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'"
};
/** XML 字符实体解码（&amp; / &#x4e2d; / &#20013; 等） */
function decodeXmlText(s) {
	return s.replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g, (whole, hex, dec, name) => {
		if (hex) {
			const cp = parseInt(hex, 16);
			return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
		}
		if (dec) {
			const cp = parseInt(dec, 10);
			return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
		}
		return (name && XML_ENTITIES[name]) ?? whole;
	});
}
/** 逐个收集全局匹配（含捕获组） */
function matchAll(re, text) {
	const out = [];
	re.lastIndex = 0;
	let m;
	while ((m = re.exec(text)) !== null) out.push(m);
	return out;
}
/** 解析标签属性（名称="值"），值做实体解码 */
function parseAttrs(tag) {
	const out = {};
	for (const m of matchAll(/([\w:.-]+)\s*=\s*"([^"]*)"/g, tag)) out[m[1]] = decodeXmlText(m[2]);
	return out;
}
/** 工作表清单：name + r:id（保持 workbook.xml 顺序） */
function workbookSheets(xml) {
	const out = [];
	for (const m of matchAll(/<sheet\b[^>]*?(?:\/>|>)/g, xml)) {
		const a = parseAttrs(m[0]);
		if (a.name && a["r:id"]) out.push({
			name: a.name,
			rid: a["r:id"]
		});
	}
	return out;
}
/** 关系映射：Id → Target */
function relTargets(xml) {
	const map = /* @__PURE__ */ new Map();
	for (const m of matchAll(/<Relationship\b[^>]*?(?:\/>|>)/g, xml)) {
		const a = parseAttrs(m[0]);
		if (a.Id && a.Target) map.set(a.Id, a.Target);
	}
	return map;
}
/** 目标路径归一：相对路径补 xl/ 前缀，绝对路径去前导斜杠 */
function resolveTarget(target) {
	if (target.startsWith("/")) return target.slice(1);
	if (target.startsWith("xl/")) return target;
	return `xl/${target}`;
}
/** 共享字符串表（含富文本 run；剔除注音 rPh 避免混入） */
function parseSharedStrings(xml) {
	const out = [];
	for (const m of matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g, xml)) {
		const body = (m[1] ?? "").replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
		let text = "";
		for (const t of matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g, body)) text += t[1] ?? "";
		out.push(decodeXmlText(text));
	}
	return out;
}
/** 单元格值：t=s 共享字符串 / inlineStr 内联字符串 / 其余取 v 原文（数值直接保留文本） */
function cellValue(attrs, inner, shared) {
	const body = inner ?? "";
	if (attrs.t === "inlineStr") {
		const isMatch = /<is\b[^>]*>([\s\S]*?)<\/is>/.exec(body);
		let text = "";
		if (isMatch) for (const t of matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g, isMatch[1])) text += t[1] ?? "";
		return decodeXmlText(text);
	}
	const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body);
	const raw = v ? decodeXmlText(v[1]) : "";
	if (attrs.t === "s") return shared[parseInt(raw, 10)] ?? "";
	return raw;
}
/** 列引用（如「K7」）→ 0 基列号；无法解析返回 -1 */
function colIndexOf(ref) {
	let n = 0;
	let seen = false;
	for (const ch of ref) {
		const c = ch.charCodeAt(0);
		if (c >= 65 && c <= 90) {
			n = n * 26 + (c - 64);
			seen = true;
		} else if (c >= 97 && c <= 122) {
			n = n * 26 + (c - 96);
			seen = true;
		} else break;
	}
	return seen ? n - 1 : -1;
}
/** 解析工作表：按 r 属性定位行/列，稀疏处补空串；行数覆盖最后一行 */
function parseSheetRows(xml, shared) {
	const sparse = [];
	let seq = 0;
	for (const rm of matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g, xml)) {
		const rowAttrs = parseAttrs(/<row\b[^>]*?\/?>/.exec(rm[0])?.[0] ?? "");
		const idx = (rowAttrs.r ? parseInt(rowAttrs.r, 10) : ++seq) - 1;
		while (sparse.length <= idx) sparse.push([]);
		const cells = sparse[idx];
		let lastCol = -1;
		for (const cm of matchAll(/<c\b[^>]*?(?:\/>|>([\s\S]*?)<\/c>)/g, rm[1] ?? "")) {
			const cAttrs = parseAttrs(/<c\b[^>]*?\/?>/.exec(cm[0])?.[0] ?? "");
			const ci = cAttrs.r ? colIndexOf(cAttrs.r) : -1;
			const col = ci >= 0 ? ci : lastCol + 1;
			cells[col] = cellValue(cAttrs, cm[1], shared);
			lastCol = col;
		}
	}
	let width = 0;
	for (const r of sparse) width = Math.max(width, r.length);
	return sparse.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
}
/**
* 读取 XLSX：返回全部工作表（名称 + 单元格矩阵）。
* 解析失败抛可操作中文错误（上层转 tips 并提示不要重试）。
*/
function readXlsx(bytes) {
	const entries = readZipEntries(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
	const workbookXml = entries.get("xl/workbook.xml")?.toString("utf8");
	if (!workbookXml) throw new Error("无法解析 XLSX 文件：缺少工作表定义（不是有效的 Excel 文档）。");
	const relsXml = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8");
	const rels = relsXml ? relTargets(relsXml) : /* @__PURE__ */ new Map();
	const sharedXml = entries.get("xl/sharedStrings.xml")?.toString("utf8");
	const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
	return workbookSheets(workbookXml).map(({ name, rid }) => {
		const target = rels.get(rid);
		const data = target ? entries.get(resolveTarget(target)) : void 0;
		return {
			name,
			rows: data ? parseSheetRows(data.toString("utf8"), shared) : []
		};
	});
}

//#endregion
//#region .build-temp/src/queries/stats.ts
/** 全港合计行名称（简体归一后） */
const GRAND_ZONE = "所有分区";
/** 数值清洗：'-'（不适用）与非法值 → 0 */
function toNumber$1(raw) {
	const s = (raw ?? "").replace(/[",$\s]/g, "");
	if (!s) return 0;
	const n = Number(s);
	return Number.isFinite(n) ? n : 0;
}
/**
* 区域名折叠：英文名（Sha Tin）与简繁/「区」字差异统一。
* 可解析为 18 区时用标准简体名（含「区」），否则返回归一化原文（区域组/合计行）。
*/
function foldZone(raw) {
	const s = (raw ?? "").trim();
	const d = resolveDistrict(s);
	return normalizeCjk(d ? d.zh : s);
}
/** 数字字段列表 */
const STAT_NUMBER_FIELDS = [
	"total",
	"s1",
	"s2",
	"s3",
	"s4",
	"s5",
	"s6",
	"s7"
];
/** 官方 XLSX 目标工作表：「表3(b)」 */
const SHEET_3B = /表\s*3\s*\(b\)/;
/** 级别标签 → 字段（官方表「級別」列取值：中一至中七 + 所有級別） */
const LEVEL_FIELDS = [
	{
		label: "中一",
		field: "s1"
	},
	{
		label: "中二",
		field: "s2"
	},
	{
		label: "中三",
		field: "s3"
	},
	{
		label: "中四",
		field: "s4"
	},
	{
		label: "中五",
		field: "s5"
	},
	{
		label: "中六",
		field: "s6"
	},
	{
		label: "中七",
		field: "s7"
	},
	{
		label: "所有級別",
		field: "total"
	}
];
/** 「總計·學生人數」所在列（表3(b) 0 基第 11 列） */
const TOTAL_STUDENTS_COL = 11;
/** 区域组口径：官方表无区域组行 → 按区议会分区归属（4/5/9 区）求和生成 */
const REGION_GROUPS = [
	{
		zone: "香港島",
		members: [
			"中西區",
			"灣仔",
			"東區",
			"南區"
		]
	},
	{
		zone: "九龍",
		members: [
			"深水埗",
			"油尖旺",
			"九龍城",
			"黃大仙",
			"觀塘"
		]
	},
	{
		zone: "新界",
		members: [
			"荃灣",
			"屯門",
			"元朗",
			"北區",
			"大埔",
			"沙田",
			"西貢",
			"離島",
			"葵青"
		]
	}
];
/** 空统计行（字段待填） */
function emptyRow(zone) {
	return {
		zone,
		zoneSimp: normalizeCjk(zone),
		total: 0,
		s1: 0,
		s2: 0,
		s3: 0,
		s4: 0,
		s5: 0,
		s6: 0,
		s7: 0
	};
}
/**
* 从「表3(b)」矩阵提取统计行：
* 分区名仅出现在每块首行（向下填充）；「所有級別」行即合计；「-」/缺省按 0。
*/
function extractStudentStats(rows) {
	const acc = /* @__PURE__ */ new Map();
	let zone = "";
	for (const row of rows) {
		const head = (row[0] ?? "").trim();
		if (head) zone = head;
		const level = (row[2] ?? "").trim();
		const field = LEVEL_FIELDS.find((l) => l.label === level)?.field;
		if (!field || !zone) continue;
		let rec = acc.get(zone);
		if (!rec) {
			rec = emptyRow(zone);
			acc.set(zone, rec);
		}
		rec[field] = toNumber$1(row[TOTAL_STUDENTS_COL]);
	}
	return [...acc.values()];
}
/** 区域组行：按成员求和；成员缺失（官方口径变化）则该组跳过 */
function sumRegions(districts) {
	const out = [];
	for (const group of REGION_GROUPS) {
		const members = [];
		for (const name of group.members) {
			const hit = districts.find((r) => foldZone(r.zone) === foldZone(name));
			if (!hit) break;
			members.push(hit);
		}
		if (members.length !== group.members.length) continue;
		const rec = emptyRow(group.zone);
		for (const m of members) for (const f of STAT_NUMBER_FIELDS) rec[f] += m[f];
		out.push(rec);
	}
	return out;
}
/**
* 解析官方统计 XLSX（《按分區及級別劃分的學校數目及學生人數》「表3(b)」）：
* 取「總計·學生人數」列生成 18 区 + 全港合计，区域组按官方归属求和生成。
*/
function parseStudentStatsFromXlsx(bytes) {
	const sheet = readXlsx(bytes).find((s) => SHEET_3B.test(s.name));
	if (!sheet) throw new Error("统计文件中未找到「表3(b)」工作表：官方文件结构可能已变更，请稍后重试。");
	const rows = extractStudentStats(sheet.rows);
	const grandTotal = rows.find((r) => r.zoneSimp === GRAND_ZONE);
	const districts = rows.filter((r) => r !== grandTotal && resolveDistrict(r.zone) !== void 0);
	return {
		grandTotal,
		regions: sumRegions(districts),
		districts
	};
}
/**
* 按区名查统计（单区明细）：
* 支持简体/繁体/「区」字省略/英文名；「全港/所有分區/全部」返回合计行；未命中 undefined。
*/
function findStudentStats(stats, zone) {
	const q = foldZone(zone);
	if (!q) return void 0;
	if (q === "全港" || q === GRAND_ZONE || q === "全部") return stats.grandTotal;
	const pool = [...stats.districts, ...stats.regions];
	for (const r of pool) if (foldZone(r.zone) === q) return r;
	if (q.length >= 2) for (const r of pool) {
		const f = foldZone(r.zone);
		if (f.includes(q) || q.includes(f)) return r;
	}
}
/** 全港 18 区对比：按所有級别人数降序（纯函数，不修改原数组） */
function rankDistrictsByTotal(stats) {
	return [...stats.districts].sort((a, b) => b.total - a.total);
}

//#endregion
//#region .build-temp/src/name-match.ts
/**
* 按校名匹配（query 需已归一化为简体）。
* 精确优先 → 双向包含（兼容 SCH_LOC 的班次后缀，如「聖士提反堂小學暨幼稚園(下午)」匹配概览的「聖士提反堂小學暨幼稚園」）。
*/
function matchByName(list, query) {
	if (!list || !query) return void 0;
	for (const item of list) if (item.nameSimp && item.nameSimp === query) return item;
	for (const item of list) {
		if (!item.nameSimp) continue;
		if (item.nameSimp.includes(query) || query.includes(item.nameSimp)) return item;
	}
}
/**
* 全部匹配（query 需已归一化为简体）：精确优先；无精确命中时返回全部包含匹配（可多分校/多班级行）。
*/
function matchAllByName(list, query) {
	if (!list || !query) return [];
	const exact = list.filter((item) => item.nameSimp && item.nameSimp === query);
	if (exact.length > 0) return exact;
	return list.filter((item) => item.nameSimp && (item.nameSimp.includes(query) || query.includes(item.nameSimp)));
}

//#endregion
//#region .build-temp/src/xml.ts
/** 解码 XML 实体（数字实体 + 五个预定义实体；&amp; 最后解码避免二次解码） */
function decodeEntities(s) {
	return s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
/**
* 流式扫描记录块（大文件场景避免一次性数组堆积）；返回命中块数。
* visit 收到记录标签之间的原始块文本。
*/
function scanBlocks(xml, tag, visit) {
	const open = `<${tag}>`;
	const close = `</${tag}>`;
	let pos = 0;
	let count = 0;
	for (;;) {
		const s = xml.indexOf(open, pos);
		if (s === -1) break;
		const e = xml.indexOf(close, s + open.length);
		if (e === -1) break;
		visit(xml.slice(s + open.length, e));
		pos = e + close.length;
		count += 1;
	}
	return count;
}
/**
* 提取单个字段值：实体解码 + 值内换行归一为空格 + 首尾空白清理；缺失或空值返回 undefined。
* 值内多空格有意保留（官方原文形式）。
*/
function getField(block, name) {
	const open = `<${name}>`;
	const close = `</${name}>`;
	const s = block.indexOf(open);
	if (s === -1) return void 0;
	const e = block.indexOf(close, s + open.length);
	if (e === -1) return void 0;
	const value = decodeEntities(block.slice(s + open.length, e)).replace(/\s*[\r\n]+\s*/g, " ").trim();
	return value === "" ? void 0 : value;
}

//#endregion
//#region .build-temp/src/queries/registration.ts
/** 未命中提示（需求 6.3）：官立学校不在注册名册内 */
const REG_NOT_FOUND_TIP = "未找到该校的注册记录。注意：学校注册名册不包含官立学校（涵盖除官立学校外的幼稚园/小学/中学/专上院校），若您查询的是官立学校，查无记录属正常情况。";
/** 匹配用归一化：简繁 + 全角 ASCII/全角空格 → 半角（数据校名含全角数字，如「６１１教育中心」） */
function normalizeRegName(s) {
	return normalizeCjk(s).replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 65248)).replace(/\u3000/g, " ");
}
/** 数值字段解析：缺失/非法 → undefined */
function toOptionalNumber(raw) {
	if (raw === void 0) return void 0;
	const n = Number(raw);
	return Number.isFinite(n) ? n : void 0;
}
/** 解析基本信息 XML（SchoolBasicInfo，小/中/幼/其他/专上混排） */
function parseRegBasic(xml) {
	const out = [];
	scanBlocks(xml, "SchoolBasicInfo", (b) => {
		const name = getField(b, "SchoolNameChi") ?? "";
		out.push({
			name,
			nameEn: getField(b, "SchoolNameEng") ?? "",
			nameSimp: normalizeRegName(name),
			schoolNumber: getField(b, "SchoolNumber") ?? "",
			locationId: getField(b, "LocationID") ?? "",
			level: getField(b, "SchoolLevelChi") ?? "",
			session: getField(b, "SchoolSessionChi") ?? "",
			gender: getField(b, "StudentGenderChi") ?? "",
			district: getField(b, "DistrictChi") ?? "",
			financeType: getField(b, "FinanceTypeChi") ?? "",
			phone: getField(b, "TelephoneNumber"),
			website: getField(b, "SchoolWebSite"),
			address: getField(b, "SchoolAddressChi") ?? "",
			addressEn: getField(b, "SchoolAddressEng") ?? "",
			status: getField(b, "RegistrationStatusChi") ?? "",
			registrationNumber: getField(b, "SchoolRegistrationNumber") ?? "",
			provisionalDate: getField(b, "ProvisionalRegistrationDate"),
			registrationDate: getField(b, "RegistrationDate")
		});
	});
	return out;
}
/** 解析校舍 XML（SchoolPremises） */
function parseRegPremises(xml) {
	const out = [];
	scanBlocks(xml, "SchoolPremises", (b) => {
		const name = getField(b, "SchoolNameChi") ?? "";
		out.push({
			name,
			nameEn: getField(b, "SchoolNameEng") ?? "",
			nameSimp: normalizeRegName(name),
			schoolNumber: getField(b, "SchoolNumber") ?? "",
			premisesCode: getField(b, "PremisesCode") ?? "",
			desc: getField(b, "PremisesDescChi") ?? "",
			descEn: getField(b, "PremisesDescEng") ?? ""
		});
	});
	return out;
}
/** 解析批准容额 XML（SchoolAccommodation，房间级 4 万+ 条） */
function parseRegAccommodation(xml) {
	const out = [];
	scanBlocks(xml, "SchoolAccommodation", (b) => {
		const name = getField(b, "SchoolNameChi") ?? "";
		out.push({
			name,
			nameSimp: normalizeRegName(name),
			schoolNumber: getField(b, "SchoolNumber") ?? "",
			premisesCode: getField(b, "PremisesCode") ?? "",
			subPremisesCode: getField(b, "SubPremisesCode") ?? "",
			roomType: getField(b, "RoomType") ?? "",
			roomNo: getField(b, "RoomNo") ?? "",
			permitted: toOptionalNumber(getField(b, "PermittedAccommodation")) ?? 0,
			kgwd: toOptionalNumber(getField(b, "PermittedAccommodationKGWD")),
			remarks: getField(b, "RemarksChi")
		});
	});
	return out;
}
/**
* 按校名查询注册资料：精确优先 → 包含匹配候选。
* 返回同校多级别/时段全部记录 + 关联校舍与房间容额；完全查无返回 undefined。
*/
function findRegistration(basic, premises, rooms, query) {
	const q = normalizeRegName((query ?? "").trim());
	if (!q) return void 0;
	const exact = basic.some((r) => r.nameSimp === q);
	const matches = matchAllByName(basic, q);
	if (matches.length === 0) return void 0;
	const numbers = new Set(matches.map((r) => r.schoolNumber));
	return {
		exact,
		matches,
		premises: premises.filter((p) => numbers.has(p.schoolNumber)),
		rooms: rooms.filter((r) => numbers.has(r.schoolNumber))
	};
}

//#endregion
//#region .build-temp/src/format.ts
/** 空结果防重试（需求 9.3：阻止 LLM 重复调用） */
const TIP_NO_RETRY_EMPTY = "该结果已为最终查询结果，请直接告知用户，不要重复调用本工具。";
/** 错误防重试（需求 9.3） */
const TIP_NO_RETRY_ERROR = "请将错误说明转达用户，不要重复调用本工具。";
/** 过期缓存降级提示（需求 8：数据新鲜度标注；下载失败回退旧缓存时追加） */
const TIP_STALE = "部分数据来自本地缓存（下载暂时失败），数据可能不是最新。";
/** 数据源引用标注（需求 8.1：答案中标注来源） */
const SOURCE_LABELS = {
	sch_loc: "资料来源：教育局《学校位置总表》",
	kgp: "资料来源：教育局《幼稚园概览 2025》",
	psp: "资料来源：家庭与学校合作事宜委员会《小学概览 2025》",
	ssp: "资料来源：家庭与学校合作事宜委员会《中学概览 2025/26》",
	through_train: "资料来源：教育局《「一条龙」学校名单（2026/27 学年）》",
	poa: "资料来源：教育局《小一入学统筹办法：学校网范围》",
	sspa: "资料来源：教育局《中学学位分配办法：学校网资料》",
	k1_not_joining: "资料来源：教育局《参加「K1 收生安排」而非幼稚园教育计划的幼稚园名单（2026/27）》",
	k1k3_vacancy: "资料来源：教育局《K1–K3 学位空缺资讯》（每周更新）",
	kg_scheme: "资料来源：教育局《免费优质幼稚园教育计划名单（2025/26 学年）》",
	dss_fee: "资料来源：教育局《直资学校学费表（2025/26 学年）》",
	non_aided_ccc: "资料来源：教育局《附设于幼稚园的非资助幼儿中心名单》",
	tab0407: "资料来源：教育局《按分区及级别统计的中学日校学生人数》",
	reg: "资料来源：教育局《学校注册资料》（基本信息 / 校舍 / 批准容额）",
	nearby: "资料来源：教育局「就近入学资讯」（data.gov.hk 实时接口）"
};
/** 数据日期/学年标注（需求 8.1–8.3） */
const DATA_DATES = {
	sch_loc: "不定期更新",
	kgp: "2025/26 学年",
	psp: "2025/26 学年",
	ssp: "2025/26 学年",
	through_train: "2026/27 学年",
	poa: "每年更新",
	sspa: "每年更新",
	k1_not_joining: "2026/27 学年",
	k1k3_vacancy: "每周更新",
	kg_scheme: "2025/26 学年",
	dss_fee: "2025/26 学年",
	non_aided_ccc: "每年更新",
	tab0407: "2025/26 学年",
	reg: "每季更新",
	nearby: "实时数据"
};
/** 简体化（输出统一简体；数据原文为繁体时转换） */
function zh(s) {
	return normalizeCjk(s ?? "");
}
/** 列表去重（保序、剔空） */
function uniq(list) {
	return [...new Set(list.filter((s) => s !== ""))];
}
/** 千分位格式化（仅展示用，数值直引不变） */
function fmtNum(n) {
	return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
/** 级别代码 → 中文标签 */
const LEVEL_LABELS = {
	kg: "幼稚园",
	primary: "小学",
	secondary: "中学",
	other: "特殊学校"
};
function levelLabel(level) {
	return LEVEL_LABELS[level] ?? level;
}
/** K1-K3 空缺状态标注（原文 Y/N/P 直引 + 可读注释） */
function vacancyLabel(v) {
	const s = (v ?? "").trim().toUpperCase();
	if (s === "Y") return "Y（有空缺）";
	if (s === "N") return "N（暂无空缺）";
	if (s === "P") return "P（待定，建议直接联系学校）";
	return v || "未提供";
}
/** 是/否（布尔 → 中文） */
function yesNo(b) {
	return b ? "是" : "否";
}
/** 组装统一输出：缺省 items=[]、sources/tips 去重 */
function buildToolResult(parts) {
	const result = {
		summary: parts.summary,
		items: parts.items ?? [],
		dataDate: parts.dataDate ?? "",
		sources: uniq(parts.sources ?? []),
		tips: uniq(parts.tips ?? [])
	};
	if (parts.error !== void 0) result.error = parts.error;
	return result;
}
/** 学校位置总表记录 → 输出条目（简体展示） */
function recordToItem(r) {
	return {
		name: r.nameSimp || zh(r.nameZh),
		nameEn: r.nameEn,
		level: r.level,
		district: zh(r.districtZh),
		address: zh(r.addressZh),
		telephone: r.telephone,
		website: r.website,
		extra: {
			category: zh(r.categoryZh),
			session: zh(r.session),
			financeType: zh(r.financeType)
		}
	};
}
/** 距离展示：「约 245 米」/「1.2 公里」 */
function fmtDistance(m) {
	return m >= 1e3 ? `${(m / 1e3).toFixed(1)} 公里` : `约 ${m} 米`;
}
function formatNearby(schools, locationLabel) {
	const label = zh(locationLabel);
	if (schools.length === 0) return buildToolResult({
		summary: `未找到「${label}」附近的学校。请提示用户更换地点（可用区域名、地标名或直接提供「纬度,经度」坐标）。`,
		dataDate: DATA_DATES.nearby,
		sources: [SOURCE_LABELS.nearby],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	const listed = schools.slice(0, 5).map((s, i) => `${i + 1}. ${s.name}（${s.category || levelLabel(s.level)}，${fmtDistance(s.distanceMeters)}）`);
	const more = schools.length > 5 ? `\n……另有 ${schools.length - 5} 所，详见条目列表。` : "";
	return buildToolResult({
		summary: `在「${label}」附近找到 ${schools.length} 所学校（按距离由近到远）：\n${listed.join("\n")}${more}`,
		items: schools.map((s) => ({
			name: s.name,
			nameEn: s.nameEn,
			level: s.level,
			district: s.district,
			address: s.address,
			telephone: s.telephone,
			website: s.website,
			distanceMeters: s.distanceMeters,
			extra: {
				category: s.category,
				sessions: s.sessions
			}
		})),
		dataDate: DATA_DATES.nearby,
		sources: [SOURCE_LABELS.nearby],
		tips: ["距离为按学校坐标与查询点估算的直线距离，仅供参考。"]
	});
}
/** 办学类型枚举 → 短标签（数量摘要展示用） */
const CATEGORY_SHORT = {
	international: "国际",
	direct_subsidy: "直资",
	government: "官立",
	aided: "资助",
	private: "私立",
	esf: "英基"
};
/** 级别展示固定序（数量拆分用） */
const LEVEL_ORDER = [
	"kg",
	"primary",
	"secondary",
	"other"
];
/** 数量构成展示门槛：总数不超过该值时条目本身已可浏览，不附构成 */
const COUNT_DETAIL_MIN_TOTAL = 15;
/** 类别构成展示上限（超出部分合并为「其他」） */
const COUNT_DETAIL_LIMIT = 5;
/** 搜索对象名词：名称关键词 > 类别+级别（如「直资中学」）> 级别 > 「学校」 */
function searchNoun(ctx) {
	if (ctx.name) return `名称含「${zh(ctx.name)}」的学校`;
	const level = ctx.level ? levelLabel(ctx.level) : "";
	if (ctx.category) {
		const cat = CATEGORY_SHORT[ctx.category];
		return level ? `${cat}${level}` : `${cat}学校`;
	}
	return level || "学校";
}
/**
* 数量构成（截断前全量口径）：级别拆分 + 办学类型构成。
* 名称查询、少结果（≤15）不附；未指定级别/类别且分布 ≥ 2 类时才分别附上。
*/
function countBreakdown(result, ctx) {
	if (ctx.name || result.total <= COUNT_DETAIL_MIN_TOTAL) return "";
	const parts = [];
	if (!ctx.level) {
		const levels = LEVEL_ORDER.map((lv) => ({
			label: levelLabel(lv),
			count: result.levelCounts[lv] ?? 0
		})).filter((x) => x.count > 0);
		if (levels.length >= 2) parts.push(`其中${levels.map((x) => `${x.label} ${x.count} 所`).join("、")}`);
	}
	if (!ctx.category && result.categoryCounts.length >= 2) {
		const top = result.categoryCounts.slice(0, COUNT_DETAIL_LIMIT);
		const rest = result.categoryCounts.slice(COUNT_DETAIL_LIMIT).reduce((acc, x) => acc + x.count, 0);
		const detail = top.map((x) => `${x.label} ${x.count} 所`).join("、") + (rest > 0 ? `、其他 ${rest} 所` : "");
		parts.push(`按办学类型：${detail}`);
	}
	return parts.join("；");
}
function formatSearch(result, ctx) {
	const source = SOURCE_LABELS.sch_loc;
	const date = DATA_DATES.sch_loc;
	const noun = searchNoun(ctx);
	const place = ctx.district ? `（范围：${zh(ctx.district)}）` : "";
	if (result.total === 0) {
		const sug = result.suggestions.length > 0 ? `您是否想找：${result.suggestions.join("、")}？` : "请提示用户换一个关键词，或改用「区域 + 级别」（如「沙田区小学」）查询。";
		return buildToolResult({
			summary: `未找到${ctx.name ? `名称含「${zh(ctx.name)}」的` : "符合条件的"}学校。${sug}`,
			dataDate: date,
			sources: [source],
			tips: [TIP_NO_RETRY_EMPTY]
		});
	}
	const breakdown = countBreakdown(result, ctx);
	const summary = `共查询到 ${result.total} 所${noun}${place}` + (breakdown ? `；${breakdown}` : "") + (result.truncated ? `，当前仅展示前 ${result.items.length} 所` : "") + "。";
	const tips = result.truncated ? [`结果较多，仅展示前 ${result.items.length} 所；如需更多请提示用户收窄条件（如指定区域或级别）。`] : [];
	return buildToolResult({
		summary,
		items: result.items.map(recordToItem),
		dataDate: date,
		sources: [source],
		tips
	});
}
function formatDetail(detail) {
	const r = detail.record;
	const name = r.nameSimp || zh(r.nameZh);
	const lines = [];
	lines.push(`【${name}】${levelLabel(r.level)}（${zh(r.categoryZh)}）`);
	const contact = [];
	if (r.addressZh) contact.push(`地址：${zh(r.addressZh)}`);
	if (r.telephone) contact.push(`电话：${r.telephone}`);
	if (r.website) contact.push(`网站：${r.website}`);
	if (contact.length > 0) lines.push(contact.join("｜"));
	const sources = [SOURCE_LABELS.sch_loc];
	const tips = [];
	let dataDate = DATA_DATES.sch_loc;
	if (detail.kg) {
		const k = detail.kg;
		lines.push(`幼稚园概览：参加幼稚园教育计划：${zh(k.joinsScheme) || "未提供"}｜课程类别：${zh(k.curriculum) || "未提供"}｜半日班全年学费：${k.feeHalfDay || "官方未提供"}｜全日班全年学费：${k.feeWholeDay || "官方未提供"}｜师生比（上午）：${k.teacherRatioAm || "未提供"}｜总容额：${k.capacity || "未提供"}`);
		if (k.applicationStart || k.applicationEnd) lines.push(`报名期：${k.applicationStart || "—"} 至 ${k.applicationEnd || "—"}`);
		sources.push(SOURCE_LABELS.kgp);
		dataDate = DATA_DATES.kgp;
	}
	if (detail.vacancy) {
		const v = detail.vacancy;
		lines.push(`K1-K3 学位空缺（截至 ${v.asAtDate}）：K1：${vacancyLabel(v.k1)}｜K2：${vacancyLabel(v.k2)}｜K3：${vacancyLabel(v.k3)}`);
		sources.push(SOURCE_LABELS.k1k3_vacancy);
		dataDate = `截至 ${v.asAtDate}`;
		tips.push("K1-K3 学位空缺数据每周更新，请以结果中的截至日期为准。");
	}
	if (detail.primary) {
		const p = detail.primary;
		const rel = [];
		if (p.throughTrain) rel.push(`一条龙中学：${zh(p.throughTrain)}`);
		if (p.feeder) rel.push(`直属中学：${zh(p.feeder)}`);
		if (p.nominated) rel.push(`联系中学：${zh(p.nominated)}`);
		lines.push(`小学概览：小一校网：${p.schoolNet || "未提供"}｜教学语言：${zh(p.teachingLanguage) || "未提供"}｜学费：${p.fee || "官方未提供"}${rel.length > 0 ? "｜" + rel.join("｜") : ""}`);
		sources.push(SOURCE_LABELS.psp);
		dataDate = DATA_DATES.psp;
	}
	if (detail.secondary) {
		const s = detail.secondary;
		const cls = s.classStructure;
		lines.push(`中学概览：教师人数：${s.teacherCount || "未提供"}｜班级结构（中一至中六）：${cls.s1}/${cls.s2}/${cls.s3}/${cls.s4}/${cls.s5}/${cls.s6}｜中一学费：${s.fees.s1 || "官方未提供"}`);
		sources.push(SOURCE_LABELS.ssp);
		dataDate = DATA_DATES.ssp;
	}
	tips.push(...detail.missing);
	tips.push("详细课程内容与最新安排请查阅该校官方网站。");
	return buildToolResult({
		summary: lines.join("\n"),
		items: [recordToItem(r)],
		dataDate,
		sources,
		tips
	});
}
function formatNetPoa(list, area) {
	const label = zh(area);
	const source = SOURCE_LABELS.poa;
	const date = DATA_DATES.poa;
	if (list.length === 0) return buildToolResult({
		summary: `未找到「${label}」相关的小一学校网。请提示用户改用 18 区区域名（如「沙田区」）或地名（如「将军澳」）查询。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	const lines = list.map((p) => `· ${p.net} 网：${zh(p.area)}｜详情页：${p.webpage}`);
	return buildToolResult({
		summary: `「${label}」对应小一学校网（共 ${list.length} 个）：\n${lines.join("\n")}`,
		items: list.map((p) => ({
			name: `${p.net} 网`,
			district: p.districtZh,
			extra: {
				net: p.net,
				area: zh(p.area),
				webpage: p.webpage
			}
		})),
		dataDate: date,
		sources: [source]
	});
}
function formatNetSspaSchool(record, name) {
	const label = zh(name);
	const source = SOURCE_LABELS.sspa;
	const date = DATA_DATES.sspa;
	if (!record) return buildToolResult({
		summary: `未找到中学「${label}」的派位校网记录。该中学可能不在中学学位分配办法学校网名单内，或校名有误；请提示用户核对校名（可改用「区域 + 级别」搜索确认校名）。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	return buildToolResult({
		summary: `【${zh(record.name)}】中学派位校网：所属区域网：${record.net}（${record.districtZh}）｜服务校网：${record.servedNets.join("、")}。`,
		items: [{
			name: zh(record.name),
			level: "secondary",
			district: record.districtZh,
			extra: {
				net: record.net,
				dist: record.dist,
				schCode: record.schCode,
				servedNets: record.servedNets
			}
		}],
		dataDate: date,
		sources: [source]
	});
}
function formatNetSspaNet(records, net) {
	const key = (net ?? "").trim().toUpperCase();
	const source = SOURCE_LABELS.sspa;
	const date = DATA_DATES.sspa;
	if (records.length === 0) return buildToolResult({
		summary: `未找到服务「${key}」校网的中学。请提示用户核对校网编号（HK1–HK4 / KL1–KL5 / NT1–NT9）。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	const names = records.slice(0, 10).map((x) => zh(x.name));
	return buildToolResult({
		summary: `服务 ${key} 校网的中学共 ${records.length} 所（按官方表序）：${names.join("、")}${records.length > 10 ? " 等" : ""}。`,
		items: records.map((x) => ({
			name: zh(x.name),
			level: "secondary",
			district: x.districtZh,
			extra: {
				net: x.net,
				dist: x.dist,
				schCode: x.schCode
			}
		})),
		dataDate: date,
		sources: [source]
	});
}
function formatList(input) {
	switch (input.type) {
		case "through_train": return formatThroughTrain(input);
		case "dss_fee": return formatDssFee(input);
		case "kg_scheme": return formatKgScheme(input);
		case "k1_not_joining": return formatK1NotJoining(input);
		case "non_aided_ccc": return formatNonAidedCcc(input);
	}
}
function formatThroughTrain(input) {
	const date = DATA_DATES.through_train;
	const source = SOURCE_LABELS.through_train;
	const label = zh(input.queryName ?? input.district ?? "");
	const items = input.records.map((r) => ({
		name: zh(r.name),
		district: zh(r.district),
		extra: { groupNo: r.groupNo }
	}));
	if (input.queryName && input.records.length === 0) return buildToolResult({
		summary: `「${label}」不在「一条龙」学校名单中（2026/27 学年）。未命中即为最终结果，不代表该校与任何小学/中学结龙。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	if (input.queryName) return buildToolResult({
		summary: `「${label}」在「一条龙」学校名单中（2026/27 学年），结龙组别成员：${input.records.map((r) => zh(r.name)).join("、")}（小学与中学可直升）。`,
		items,
		dataDate: date,
		sources: [source]
	});
	return buildToolResult({
		summary: `「${label}」的一条龙学校共 ${input.records.length} 条（2026/27 学年）。`,
		items,
		dataDate: date,
		sources: [source]
	});
}
/** 学费展示：固定「全年 $N」；範圍「全年 $min–$max」 */
function fmtFee(r) {
	return r.feeMin === r.feeMax ? `全年 $${fmtNum(r.feeMin)}` : `全年 $${fmtNum(r.feeMin)}–$${fmtNum(r.feeMax)}`;
}
function formatDssFee(input) {
	const date = DATA_DATES.dss_fee;
	const source = SOURCE_LABELS.dss_fee;
	const label = zh(input.queryName ?? "");
	const items = input.records.map((r) => ({
		name: zh(r.name),
		extra: {
			level: r.level,
			classRange: r.classRange,
			feeType: r.feeType,
			feeMin: r.feeMin,
			feeMax: r.feeMax
		}
	}));
	if (input.queryName && input.records.length === 0) return buildToolResult({
		summary: `「${label}」不在直资学校学费表（2025/26 学年）中。未命中即为最终结果。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	return buildToolResult({
		summary: `「${label}」直资学校学费（2025/26 学年）：${input.records.map((r) => `（${r.level}${r.classRange}）${fmtFee(r)}`).join("；")}。`,
		items,
		dataDate: date,
		sources: [source]
	});
}
function formatKgScheme(input) {
	const date = DATA_DATES.kg_scheme;
	const source = SOURCE_LABELS.kg_scheme;
	const items = input.records.map((r) => ({
		name: zh(r.name),
		nameEn: r.nameEn,
		district: zh(r.district),
		extra: {
			no: r.no,
			districtEn: r.districtEn
		}
	}));
	if (input.queryName && input.records.length === 0) return buildToolResult({
		summary: `「${zh(input.queryName)}」不在免费优质幼稚园教育计划名单中（2025/26 学年）。未命中即为最终结果。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	if (input.queryName) return buildToolResult({
		summary: `「${zh(input.queryName)}」在免费优质幼稚园教育计划名单中（2025/26 学年）。`,
		items,
		dataDate: date,
		sources: [source]
	});
	return buildToolResult({
		summary: `「${zh(input.district ?? "")}」参加免费优质幼稚园教育计划的幼稚园共 ${input.records.length} 所（2025/26 学年）。`,
		items,
		dataDate: date,
		sources: [source]
	});
}
function formatK1NotJoining(input) {
	const date = DATA_DATES.k1_not_joining;
	const source = SOURCE_LABELS.k1_not_joining;
	const items = input.records.map((r) => ({
		name: zh(r.name),
		address: zh(r.address),
		extra: {
			onlineApplication: yesNo(r.onlineApplication),
			oneVacancyOnly: yesNo(r.oneVacancyOnly),
			shareVacancyInfo: yesNo(r.shareVacancyInfo)
		}
	}));
	if (input.queryName && input.records.length === 0) return buildToolResult({
		summary: `「${zh(input.queryName)}」不在参加「K1 收生安排」而非幼稚园教育计划的幼稚园名单中（2026/27 学年）。未命中即为最终结果。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	if (input.queryName) {
		const r = input.records[0];
		return buildToolResult({
			summary: `「${zh(r.name)}」在参加「K1 收生安排」而非幼稚园教育计划的幼稚园名单中（2026/27 学年）：网上派表：${yesNo(r.onlineApplication)}｜「一人不占多位」：${yesNo(r.oneVacancyOnly)}｜经教育局发放学位空缺信息：${yesNo(r.shareVacancyInfo)}。`,
			items,
			dataDate: date,
			sources: [source]
		});
	}
	return buildToolResult({
		summary: `「${zh(input.district ?? "")}」参加「K1 收生安排」而非幼稚园教育计划的幼稚园共 ${input.records.length} 所（2026/27 学年）。`,
		items,
		dataDate: date,
		sources: [source]
	});
}
function formatNonAidedCcc(input) {
	const date = DATA_DATES.non_aided_ccc;
	const source = SOURCE_LABELS.non_aided_ccc;
	const items = input.records.map((r) => ({
		name: zh(r.name),
		address: zh(r.address),
		telephone: r.phone,
		district: zh(r.district),
		extra: {
			serviceType: zh(r.serviceType),
			halfDayKgFee: r.halfDayKgFee,
			fullDayKgFee: r.fullDayKgFee,
			nurseryCapacity: r.nurseryCapacity,
			kgCapacity: r.kgCapacity
		}
	}));
	if (input.queryName && input.records.length === 0) return buildToolResult({
		summary: `「${zh(input.queryName)}」不在附设于幼稚园的非资助幼儿中心名单中。未命中即为最终结果。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	if (input.queryName) {
		const r = input.records[0];
		return buildToolResult({
			summary: `「${zh(r.name)}」在附设于幼稚园的非资助幼儿中心名单中：服务类别：${zh(r.serviceType) || "未提供"}｜地区：${zh(r.district) || "未提供"}｜核准月费（半日幼儿园）：${r.halfDayKgFee > 0 ? `$${fmtNum(r.halfDayKgFee)}` : "不提供"}｜容额：全日育婴园 ${r.nurseryCapacity}／全日幼儿园 ${r.kgCapacity}／半日幼儿园 ${r.halfDayCapacity}。`,
			items,
			dataDate: date,
			sources: [source]
		});
	}
	return buildToolResult({
		summary: `「${zh(input.district ?? "")}」附设于幼稚园的非资助幼儿中心共 ${input.records.length} 所。`,
		items,
		dataDate: date,
		sources: [source]
	});
}
function formatStats(stats, opts) {
	const source = SOURCE_LABELS.tab0407;
	const date = DATA_DATES.tab0407;
	if (opts.compare || !(opts.zone ?? "").trim()) {
		const ranked = rankDistrictsByTotal(stats);
		if (ranked.length === 0) return buildToolResult({
			summary: "未获取到分区学生人数统计数据。",
			dataDate: date,
			sources: [source],
			tips: [TIP_NO_RETRY_ERROR]
		});
		const first = ranked[0];
		const last = ranked[ranked.length - 1];
		return buildToolResult({
			summary: `全港 18 区中学日校学生人数（2025/26 学年，按所有级别）：${zh(first.zone)}以 ${fmtNum(first.total)} 人居首，${zh(last.zone)}以 ${fmtNum(last.total)} 人最少。`,
			items: ranked.map((r) => ({
				name: zh(r.zone),
				extra: { total: r.total }
			})),
			dataDate: date,
			sources: [source]
		});
	}
	const row = findStudentStats(stats, opts.zone);
	if (!row) return buildToolResult({
		summary: `未找到「${zh(opts.zone)}」的学生人数统计。请提示用户改用 18 区区域名（如「沙田」）或「全港」查询。`,
		dataDate: date,
		sources: [source],
		tips: [TIP_NO_RETRY_EMPTY]
	});
	return buildToolResult({
		summary: `「${zh(row.zone)}」中学日校学生人数（2025/26 学年）：所有级别 ${fmtNum(row.total)} 人｜中一 ${fmtNum(row.s1)}｜中二 ${fmtNum(row.s2)}｜中三 ${fmtNum(row.s3)}｜中四 ${fmtNum(row.s4)}｜中五 ${fmtNum(row.s5)}｜中六 ${fmtNum(row.s6)}｜中七 ${fmtNum(row.s7)}。`,
		items: [{
			name: zh(row.zone),
			extra: {
				total: row.total,
				s1: row.s1,
				s2: row.s2,
				s3: row.s3,
				s4: row.s4,
				s5: row.s5,
				s6: row.s6,
				s7: row.s7
			}
		}],
		dataDate: date,
		sources: [source]
	});
}
function formatRegistration(result, name) {
	const label = zh(name);
	const source = SOURCE_LABELS.reg;
	const date = DATA_DATES.reg;
	if (!result || !result.exact) {
		const candidates = (result?.matches ?? []).map((m) => ({
			name: zh(m.name),
			level: m.level,
			extra: {
				schoolNumber: m.schoolNumber,
				registrationNumber: m.registrationNumber,
				status: zh(m.status) || "未标明"
			}
		}));
		const candidateText = candidates.length > 0 ? `相关记录（名称相近，可能为该校旧称或关联机构）：${candidates.map((c) => c.name).join("、")}。` : "";
		return buildToolResult({
			summary: `${result ? `「${label}」未在注册名册中精确命中。` : ""}${candidateText}${REG_NOT_FOUND_TIP}`,
			items: candidates,
			dataDate: date,
			sources: [source],
			tips: [TIP_NO_RETRY_EMPTY]
		});
	}
	const roomTotal = result.rooms.reduce((acc, r) => acc + r.permitted, 0);
	const first = result.matches[0];
	return buildToolResult({
		summary: `【${zh(first.name)}】学校注册资料：注册编号：${first.registrationNumber || "未标明"}｜注册状况：${zh(first.status) || "未标明"}｜学校类别：${zh(first.financeType) || "未标明"}｜注册校舍：${result.premises.length} 处｜批准课室：${result.rooms.length} 间（容额合计 ${roomTotal} 人）。`,
		items: result.matches.map((m) => ({
			name: zh(m.name),
			nameEn: m.nameEn,
			level: m.level,
			district: zh(m.district),
			address: zh(m.address),
			telephone: m.phone ?? "",
			extra: {
				schoolNumber: m.schoolNumber,
				registrationNumber: m.registrationNumber,
				status: zh(m.status) || "未标明",
				financeType: zh(m.financeType)
			}
		})),
		dataDate: date,
		sources: [source]
	});
}

//#endregion
//#region .build-temp/src/geocode.ts
/** 18 区中心坐标（SCH_LOC 3461 条学校坐标均值；scripts/stats-district-centers.mjs 生成） */
const DISTRICT_CENTERS = {
	"CENTRAL AND WESTERN": {
		lat: 22.2823,
		lng: 114.1448
	},
	EASTERN: {
		lat: 22.279,
		lng: 114.2195
	},
	ISLANDS: {
		lat: 22.2668,
		lng: 113.9789
	},
	"KOWLOON CITY": {
		lat: 22.3234,
		lng: 114.1827
	},
	"KWAI TSING": {
		lat: 22.3595,
		lng: 114.1218
	},
	"KWUN TONG": {
		lat: 22.316,
		lng: 114.2268
	},
	NORTH: {
		lat: 22.4981,
		lng: 114.1369
	},
	"SAI KUNG": {
		lat: 22.3211,
		lng: 114.2608
	},
	"SHA TIN": {
		lat: 22.3912,
		lng: 114.2023
	},
	"SHAM SHUI PO": {
		lat: 22.3343,
		lng: 114.159
	},
	SOUTHERN: {
		lat: 22.247,
		lng: 114.1602
	},
	"TAI PO": {
		lat: 22.452,
		lng: 114.1706
	},
	"TSUEN WAN": {
		lat: 22.3713,
		lng: 114.111
	},
	"TUEN MUN": {
		lat: 22.3933,
		lng: 113.9726
	},
	"WAN CHAI": {
		lat: 22.2736,
		lng: 114.1827
	},
	"WONG TAI SIN": {
		lat: 22.3413,
		lng: 114.1991
	},
	"YAU TSIM MONG": {
		lat: 22.3153,
		lng: 114.1671
	},
	"YUEN LONG": {
		lat: 22.4522,
		lng: 114.0152
	}
};
/** 归一化查找索引（键统一简体 + 小写，与输入同一口径） */
const LANDMARK_INDEX = Object.entries({
	落马洲口岸: {
		lat: 22.5144,
		lng: 114.0683
	},
	福田口岸: {
		lat: 22.5283,
		lng: 114.0714
	},
	罗湖口岸: {
		lat: 22.5284,
		lng: 114.1131
	},
	深圳湾口岸: {
		lat: 22.4928,
		lng: 113.9446
	},
	港珠澳大桥口岸: {
		lat: 22.32,
		lng: 113.941
	},
	西九龙站: {
		lat: 22.3048,
		lng: 114.1618
	},
	莲塘口岸: {
		lat: 22.553,
		lng: 114.131
	},
	海港城: {
		lat: 22.297,
		lng: 114.1687
	},
	时代广场: {
		lat: 22.2782,
		lng: 114.1822
	},
	太古广场: {
		lat: 22.2774,
		lng: 114.1655
	},
	朗豪坊: {
		lat: 22.3182,
		lng: 114.1688
	},
	又一城: {
		lat: 22.3369,
		lng: 114.1738
	},
	兰桂坊: {
		lat: 22.2807,
		lng: 114.1559
	},
	庙街: {
		lat: 22.3088,
		lng: 114.17
	},
	女人街: {
		lat: 22.3188,
		lng: 114.1697
	},
	香港大学: {
		lat: 22.284,
		lng: 114.1363
	},
	中环: {
		lat: 22.2819,
		lng: 114.1585
	},
	金钟: {
		lat: 22.2793,
		lng: 114.1655
	},
	湾仔: {
		lat: 22.2783,
		lng: 114.1747
	},
	铜锣湾: {
		lat: 22.2801,
		lng: 114.184
	},
	北角: {
		lat: 22.291,
		lng: 114.2009
	},
	太平山顶: {
		lat: 22.2759,
		lng: 114.1455
	},
	香港立法会: {
		lat: 22.2802,
		lng: 114.1662
	},
	维多利亚港: {
		lat: 22.293,
		lng: 114.169
	},
	海洋公园: {
		lat: 22.2468,
		lng: 114.1748
	},
	星光大道: {
		lat: 22.2935,
		lng: 114.1748
	},
	柴湾: {
		lat: 22.2644,
		lng: 114.2371
	},
	筲箕湾: {
		lat: 22.2791,
		lng: 114.2289
	},
	鲗鱼涌: {
		lat: 22.2864,
		lng: 114.2098
	},
	跑马地: {
		lat: 22.27,
		lng: 114.184
	},
	坚尼地城: {
		lat: 22.2814,
		lng: 114.1289
	},
	西营盘: {
		lat: 22.2846,
		lng: 114.1429
	},
	上环: {
		lat: 22.2867,
		lng: 114.1517
	},
	天后: {
		lat: 22.2824,
		lng: 114.1917
	},
	炮台山: {
		lat: 22.2882,
		lng: 114.1922
	},
	尖沙咀: {
		lat: 22.2988,
		lng: 114.1722
	},
	旺角: {
		lat: 22.3193,
		lng: 114.1694
	},
	红磡: {
		lat: 22.3033,
		lng: 114.1818
	},
	九龙塘: {
		lat: 22.3372,
		lng: 114.176
	},
	油麻地: {
		lat: 22.3128,
		lng: 114.1705
	},
	佐敦: {
		lat: 22.3048,
		lng: 114.1713
	},
	深水埗: {
		lat: 22.3309,
		lng: 114.1624
	},
	太子: {
		lat: 22.3254,
		lng: 114.168
	},
	观塘: {
		lat: 22.3132,
		lng: 114.2252
	},
	黄大仙: {
		lat: 22.3407,
		lng: 114.1934
	},
	九龙湾: {
		lat: 22.3237,
		lng: 114.2143
	},
	牛头角: {
		lat: 22.3153,
		lng: 114.2194
	},
	蓝田: {
		lat: 22.3068,
		lng: 114.236
	},
	油塘: {
		lat: 22.2953,
		lng: 114.2372
	},
	调景岭: {
		lat: 22.3068,
		lng: 114.2522
	},
	坑口: {
		lat: 22.3172,
		lng: 114.2635
	},
	宝琳: {
		lat: 22.3219,
		lng: 114.2574
	},
	康城: {
		lat: 22.296,
		lng: 114.27
	},
	启德: {
		lat: 22.33,
		lng: 114.2
	},
	彩虹: {
		lat: 22.3492,
		lng: 114.2094
	},
	九龙城: {
		lat: 22.328,
		lng: 114.191
	},
	土瓜湾: {
		lat: 22.3166,
		lng: 114.1873
	},
	黄埔: {
		lat: 22.3049,
		lng: 114.1888
	},
	柯士甸: {
		lat: 22.3041,
		lng: 114.1663
	},
	奥运: {
		lat: 22.3181,
		lng: 114.1602
	},
	南昌: {
		lat: 22.3264,
		lng: 114.153
	},
	石硖尾: {
		lat: 22.332,
		lng: 114.1688
	},
	沙田: {
		lat: 22.3813,
		lng: 114.1886
	},
	大埔: {
		lat: 22.4513,
		lng: 114.1644
	},
	元朗: {
		lat: 22.4445,
		lng: 114.0222
	},
	屯门: {
		lat: 22.3908,
		lng: 113.9731
	},
	荃湾: {
		lat: 22.3707,
		lng: 114.1138
	},
	将军澳: {
		lat: 22.3073,
		lng: 114.2592
	},
	上水: {
		lat: 22.501,
		lng: 114.1281
	},
	粉岭: {
		lat: 22.492,
		lng: 114.1387
	},
	西贡: {
		lat: 22.3813,
		lng: 114.2709
	},
	石门: {
		lat: 22.389,
		lng: 114.2045
	},
	硕门邨: {
		lat: 22.388,
		lng: 114.2055
	},
	马鞍山: {
		lat: 22.4167,
		lng: 114.2333
	},
	大围: {
		lat: 22.3728,
		lng: 114.1789
	},
	火炭: {
		lat: 22.3969,
		lng: 114.1985
	},
	第一城: {
		lat: 22.386,
		lng: 114.203
	},
	科学园: {
		lat: 22.402,
		lng: 114.21
	},
	白石角: {
		lat: 22.405,
		lng: 114.208
	},
	屯门码头: {
		lat: 22.3722,
		lng: 113.9678
	},
	天水围: {
		lat: 22.4469,
		lng: 114.0044
	},
	洪水桥: {
		lat: 22.433,
		lng: 113.995
	},
	锦田: {
		lat: 22.439,
		lng: 114.062
	},
	流浮山: {
		lat: 22.467,
		lng: 113.981
	},
	青衣: {
		lat: 22.358,
		lng: 114.107
	},
	葵涌: {
		lat: 22.365,
		lng: 114.13
	},
	葵芳: {
		lat: 22.3569,
		lng: 114.1282
	},
	荔景: {
		lat: 22.348,
		lng: 114.1263
	},
	深井: {
		lat: 22.367,
		lng: 114.06
	},
	古洞: {
		lat: 22.503,
		lng: 114.104
	},
	打鼓岭: {
		lat: 22.553,
		lng: 114.131
	},
	美孚: {
		lat: 22.3378,
		lng: 114.137
	},
	东涌: {
		lat: 22.289,
		lng: 113.9413
	},
	香港机场: {
		lat: 22.308,
		lng: 113.9185
	},
	迪士尼乐园: {
		lat: 22.313,
		lng: 114.0413
	},
	赤柱: {
		lat: 22.2191,
		lng: 114.2121
	},
	浅水湾: {
		lat: 22.2344,
		lng: 114.1971
	},
	大屿山: {
		lat: 22.263,
		lng: 113.94
	},
	梅窝: {
		lat: 22.2642,
		lng: 114.0004
	},
	坪洲: {
		lat: 22.2845,
		lng: 114.0376
	},
	长洲: {
		lat: 22.2057,
		lng: 114.0319
	},
	南丫岛: {
		lat: 22.22,
		lng: 114.11
	},
	逸东邨: {
		lat: 22.283,
		lng: 113.935
	},
	东荟城: {
		lat: 22.289,
		lng: 113.94
	},
	博览馆: {
		lat: 22.3214,
		lng: 113.9411
	},
	欣澳: {
		lat: 22.3166,
		lng: 114.0101
	},
	九龙站: {
		lat: 22.3049,
		lng: 114.1616
	},
	青衣站: {
		lat: 22.3586,
		lng: 114.1075
	},
	香港站: {
		lat: 22.2848,
		lng: 114.1582
	},
	么地道: {
		lat: 22.297,
		lng: 114.1745
	},
	崇光百货: {
		lat: 22.2802,
		lng: 114.1843
	},
	希慎广场: {
		lat: 22.2794,
		lng: 114.1838
	},
	利园: {
		lat: 22.2785,
		lng: 114.184
	},
	置地广场: {
		lat: 22.2816,
		lng: 114.1582
	},
	IFC: {
		lat: 22.2848,
		lng: 114.1582
	},
	ICC: {
		lat: 22.3039,
		lng: 114.1606
	},
	Elements: {
		lat: 22.3047,
		lng: 114.1618
	},
	K11: {
		lat: 22.2975,
		lng: 114.174
	},
	MegaBox: {
		lat: 22.3197,
		lng: 114.2093
	},
	APM: {
		lat: 22.3123,
		lng: 114.2256
	},
	新城市广场: {
		lat: 22.3815,
		lng: 114.1891
	},
	奥海城: {
		lat: 22.3174,
		lng: 114.1602
	},
	德福广场: {
		lat: 22.323,
		lng: 114.214
	},
	荷里活广场: {
		lat: 22.3409,
		lng: 114.202
	},
	MOKO: {
		lat: 22.3222,
		lng: 114.1717
	},
	PopCorn: {
		lat: 22.3078,
		lng: 114.2595
	},
	ELEMENTS圆方: {
		lat: 22.3047,
		lng: 114.1618
	}
}).map(([name, c]) => ({
	key: normalizeCjk(name).toLowerCase(),
	label: name,
	lat: c.lat,
	lng: c.lng
}));
/** 显式坐标文本：`纬度,经度`（英文/中文逗号，容忍空格） */
const COORD_RE = /^(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)$/;
/**
* 地点 → 坐标锚点。records 提供时优先按校名匹配（学校本身作为锚点）。
* 全部解析失败返回 undefined（由调用方生成可操作中文提示）。
*/
function resolveLocation(input, records) {
	const raw = (input ?? "").trim();
	if (!raw) return void 0;
	const coord = parseCoordText(raw);
	if (coord) return coord;
	if (records && records.length > 0) {
		const school = matchSchool(raw, records);
		if (school) return school;
	}
	const key = normalizeCjk(raw).toLowerCase();
	const exact = LANDMARK_INDEX.find((item) => item.key === key);
	if (exact) return {
		lat: exact.lat,
		lng: exact.lng,
		label: exact.label
	};
	const district = resolveDistrict(raw);
	if (district) {
		const center = DISTRICT_CENTERS[district.en];
		if (center) return {
			lat: center.lat,
			lng: center.lng,
			label: district.zh
		};
	}
	const fuzzy = LANDMARK_INDEX.find((item) => item.key.includes(key) || key.includes(item.key));
	if (fuzzy) return {
		lat: fuzzy.lat,
		lng: fuzzy.lng,
		label: fuzzy.label
	};
}
/** 解析「纬度,经度」文本（范围校验；非坐标格式返回 undefined） */
function parseCoordText(raw) {
	const m = COORD_RE.exec(raw);
	if (!m) return void 0;
	const lat = Number(m[1]);
	const lng = Number(m[2]);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return void 0;
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return void 0;
	return {
		lat,
		lng,
		label: `${lat},${lng}`
	};
}
/** 校名匹配：优先精确（中/英文名），其次包含；跳过缺坐标的记录 */
function matchSchool(raw, records) {
	const simp = normalizeCjk(raw);
	const lower = raw.toLowerCase();
	for (const r of records) {
		if (r.latitude === void 0 || r.longitude === void 0) continue;
		if (r.nameSimp !== "" && r.nameSimp === simp || r.nameEn.toLowerCase() === lower) return {
			lat: r.latitude,
			lng: r.longitude,
			label: r.nameSimp || r.nameEn
		};
	}
	for (const r of records) {
		if (r.latitude === void 0 || r.longitude === void 0) continue;
		const nameEn = r.nameEn.toLowerCase();
		if (r.nameSimp !== "" && r.nameSimp.includes(simp) || nameEn !== "" && nameEn.includes(lower)) return {
			lat: r.latitude,
			lng: r.longitude,
			label: r.nameSimp || r.nameEn
		};
	}
}

//#endregion
//#region .build-temp/src/dms.ts
/**
* 解析「度-分-秒」坐标文本为十进制度。
* - 支持两段（度-分）与三段（度-分-秒）变体
* - 无效输入（空/段数不符/含非数字/分秒越界）返回 undefined
*/
function parseDms(value) {
	if (!value) return void 0;
	const parts = value.trim().split("-");
	if (parts.length < 2 || parts.length > 3) return void 0;
	if (!parts.every((p) => /^\d+(\.\d+)?$/.test(p))) return void 0;
	const [d, m, s = 0] = parts.map(Number);
	if (m >= 60 || s >= 60) return void 0;
	return d + m / 60 + s / 3600;
}

//#endregion
//#region .build-temp/src/queries/search.ts
const DEFAULT_LIMIT = 50;
const SUGGESTION_LIMIT = 3;
/** SCHOOL LEVEL 列原值 → 归一化级别（LEVEL 为空 = 特殊学校 → other） */
const LEVEL_MAP = {
	KINDERGARTEN: "kg",
	"KINDERGARTEN-CUM-CHILD CARE CENTRES": "kg",
	PRIMARY: "primary",
	SECONDARY: "secondary"
};
/** 级别原值 → 归一化级别（大小写/前后空格容错；未知或空 → other） */
function normalizeLevel(raw) {
	return LEVEL_MAP[raw.trim().toUpperCase()] ?? "other";
}
/** 类别枚举 → 官方 ENGLISH CATEGORY 子串匹配 */
const CATEGORY_MATCH = {
	international: "International Schools",
	direct_subsidy: "Direct Subsidy Scheme",
	government: "Government",
	aided: "Aided",
	private: "Private",
	esf: "English Schools Foundation"
};
/** 类别触发词（长词优先；文本先经简繁归一） */
const CATEGORY_TRIGGERS = [
	[/国际学校|国际小学|国际中学|international/i, "international"],
	[/直接资助|直资|direct subsidy/i, "direct_subsidy"],
	[/英基|english schools foundation/i, "esf"],
	[/官立|政府|公立|government/i, "government"],
	[/资助|津贴|aided|subsid/i, "aided"],
	[/私立|民办|private/i, "private"]
];
/** 文本 → 办学类型（含匹配词原文，供原话解析剥离用；未识别 undefined） */
function matchCategoryWord(text) {
	const s = normalizeCjk((text ?? "").trim());
	for (const [re, category] of CATEGORY_TRIGGERS) {
		const m = re.exec(s);
		if (m) return {
			category,
			word: m[0]
		};
	}
}
/** 类别枚举值列表（参数直传枚举时直通） */
const CATEGORY_VALUES = [
	"international",
	"direct_subsidy",
	"government",
	"aided",
	"private",
	"esf"
];
/** 文本 → 办学类型枚举（参数归一化：枚举值直通，中文类别词经触发词识别） */
function normalizeCategory(text) {
	const s = (text ?? "").trim();
	if (CATEGORY_VALUES.includes(s)) return s;
	return matchCategoryWord(s)?.category;
}
/** 记录 → 办学类型标签（数量构成展示用；类别表外的记录归「其他」） */
function categoryLabelOf(r) {
	const c = r.category;
	if (c.includes("International Schools")) return "国际学校";
	if (c.includes("Direct Subsidy Scheme")) return "直资";
	if (c.includes("English Schools Foundation")) return "英基";
	if (c.includes("Government")) return "官立";
	if (c.includes("Aided")) return "资助";
	if (c.includes("Private")) return "私立";
	if (c.includes("Caput")) return "按额津贴";
	if (c.includes("Kindergarten-cum-child")) return "幼稚园暨幼儿中心";
	if (c.includes("Kindergartens")) return "幼稚园";
	return "其他";
}
/** SCH_LOC（Tab 分隔，36 列）→ 学校记录数组 */
function parseSchLoc(text) {
	const rows = parseCsvToObjects(text, { delimiter: "	" });
	const records = [];
	for (const row of rows) {
		const nameZh = (row["中文名稱"] ?? "").trim();
		const nameEn = (row["ENGLISH NAME"] ?? "").trim();
		if (!nameZh && !nameEn) continue;
		const levelRaw = (row["SCHOOL LEVEL"] ?? "").trim();
		records.push({
			nameZh,
			nameEn,
			nameSimp: normalizeCjk(nameZh),
			category: (row["ENGLISH CATEGORY"] ?? "").trim(),
			categoryZh: (row["中文類別"] ?? "").trim(),
			addressEn: (row["ENGLISH ADDRESS"] ?? "").trim(),
			addressZh: (row["中文地址"] ?? "").trim(),
			district: (row["DISTRICT"] ?? "").trim(),
			districtZh: (row["分區"] ?? "").trim(),
			level: normalizeLevel(levelRaw),
			financeType: (row["FINANCE TYPE"] ?? "").trim(),
			session: (row["SESSION"] ?? "").trim(),
			telephone: (row["TELEPHONE"] ?? "").trim(),
			fax: (row["FAX NUMBER"] ?? "").trim(),
			website: (row["WEBSITE"] ?? "").trim(),
			religion: (row["RELIGION"] ?? "").trim(),
			latitude: parseDms(row["LATITUDE"] ?? ""),
			longitude: parseDms(row["LONGITUDE"] ?? "")
		});
	}
	return records;
}
/**
* 学校搜索：按名称（简繁/中英文包含匹配）+ 区域 + 级别过滤。
* - 名称无命中时返回相近名称候选（编辑距离 ≤ 关键词长度一半，最多 3 条）
* - 结果上限默认 50，超出标记 truncated
*/
function searchSchools(records, options = {}) {
	const limit = options.limit ?? DEFAULT_LIMIT;
	const kwName = (options.name ?? "").trim();
	const kwSimp = normalizeCjk(kwName).toLowerCase();
	const kwEn = kwName.toLowerCase();
	const districtInput = (options.district ?? "").trim();
	const district = districtInput ? resolveDistrict(districtInput) : void 0;
	let filtered = records;
	if (districtInput) filtered = district ? filtered.filter((r) => r.district === district.en) : [];
	if (options.level) filtered = filtered.filter((r) => r.level === options.level);
	if (options.category) {
		const pat = CATEGORY_MATCH[options.category];
		filtered = filtered.filter((r) => r.category.includes(pat));
	}
	if (kwSimp) filtered = filtered.filter((r) => r.nameSimp.toLowerCase().includes(kwSimp) || r.nameEn.toLowerCase().includes(kwEn));
	const levelCounts = {};
	const catMap = /* @__PURE__ */ new Map();
	for (const r of filtered) {
		levelCounts[r.level] = (levelCounts[r.level] ?? 0) + 1;
		const label = categoryLabelOf(r);
		catMap.set(label, (catMap.get(label) ?? 0) + 1);
	}
	const categoryCounts = [...catMap.entries()].map(([label, count]) => ({
		label,
		count
	})).sort((a, b) => b.count - a.count);
	const total = filtered.length;
	return {
		items: filtered.slice(0, limit),
		total,
		truncated: total > limit,
		suggestions: total === 0 && kwSimp ? nearestNames(records, kwSimp) : [],
		levelCounts,
		categoryCounts
	};
}
/** 相近名称候选：编辑距离最近、且距离 ≤ clamp(关键词长度/2, 1, 3) */
function nearestNames(records, kwSimp) {
	const maxDist = Math.max(1, Math.min(3, Math.floor(kwSimp.length / 2)));
	const scored = [];
	for (const r of records) {
		if (!r.nameSimp) continue;
		if (Math.abs(r.nameSimp.length - kwSimp.length) > maxDist) continue;
		const d = levenshtein(kwSimp, r.nameSimp);
		if (d <= maxDist) scored.push({
			name: r.nameSimp,
			d
		});
	}
	scored.sort((a, b) => a.d - b.d);
	return scored.slice(0, SUGGESTION_LIMIT).map((s) => s.name);
}
/** 编辑距离（Levenshtein，滚动数组实现） */
function levenshtein(a, b) {
	const m = a.length;
	const n = b.length;
	let prev = new Array(n + 1);
	let curr = new Array(n + 1);
	for (let j = 0; j <= n; j++) prev[j] = j;
	for (let i = 1; i <= m; i++) {
		curr[0] = i;
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
		}
		const tmp = prev;
		prev = curr;
		curr = tmp;
	}
	return prev[n];
}

//#endregion
//#region .build-temp/src/router.ts
/** 非空判断（忽略前后空格） */
const has = (v) => (v ?? "").trim() !== "";
/**
* 意图推断：显式 intent 优先；否则按参数组合推断（design.md）：
* location → nearby；listType → list；netType → net；schoolName → detail；
* district/schoolCategory → search；学校数量问法（有多少所 XX 学校）→ search；
* 学生人数问法（有多少学生，含区域）→ stats；
* query 可解析为区域/级别/类别的列举问法 → search；仅 query（校名类）→ detail（原话兜底）；
* level → search；全空 → undefined（由入口层给出补充信息提示）。
*/
function inferIntent(input) {
	if (input.intent) return input.intent;
	if (has(input.location)) return "nearby";
	if (input.listType !== void 0) return "list";
	if (input.netType !== void 0) return "net";
	if (has(input.schoolName)) return "detail";
	const raw = (input.query ?? "").trim();
	const parsed = raw ? parseQueryText(raw) : void 0;
	if (raw && isSchoolCountQuery(raw)) return "search";
	if (raw && isStudentCountQuery(raw) && (parsed?.district !== void 0 || has(input.district))) return "stats";
	if (has(input.district)) return "search";
	if (has(input.schoolCategory)) return "search";
	if (parsed) return Boolean(parsed.district || parsed.level || parsed.category) && (parsed.isListLike || parsed.rest === "") ? "search" : "detail";
	if (input.level !== void 0) return "search";
}
/** 列表/推荐类问法（归一化后匹配）——决定「区域+级别」按搜索还是按校名处理 */
const LIST_LIKE_RE = /有哪些|有什么|边些|边啲|名单|列表|推荐|介绍|一览|多少|几多|排名|哪间|哪些|哪家/;
/** 级别词（归一化后匹配） */
const LEVEL_PATTERNS = [
	[/幼稚园|幼儿园|kindergarten/i, "kg"],
	[/小学|primary/i, "primary"],
	[/中学|secondary/i, "secondary"]
];
/**
* 从用户原话中识别区域与学校级别（简繁归一后匹配）。
* 区域优先完整名（含「区」），再匹配去「区」短名（≥2 字，防「东/南/北」单字误判）。
*/
function parseQueryText(text) {
	const s = normalizeCjk((text ?? "").trim());
	if (!s) return {
		isListLike: false,
		rest: ""
	};
	let district;
	let districtWord = "";
	for (const d of DISTRICTS) if (s.includes(d.zh)) {
		district = d.zh;
		districtWord = d.zh;
		break;
	}
	if (!district) for (const d of DISTRICTS) {
		const short = d.zh.slice(0, -1);
		if (short.length >= 2 && s.includes(short)) {
			district = d.zh;
			districtWord = short;
			break;
		}
	}
	let level;
	let levelWord = "";
	for (const [re, lv] of LEVEL_PATTERNS) {
		const m = re.exec(s);
		if (m) {
			level = lv;
			levelWord = m[0];
			break;
		}
	}
	const isListLike = LIST_LIKE_RE.test(s);
	const catMatch = matchCategoryWord(s);
	const catAtStart = catMatch !== void 0 && s.indexOf(catMatch.word) === 0;
	let rest = s;
	if (districtWord) rest = rest.replace(districtWord, "");
	if (levelWord) rest = rest.replace(levelWord, "");
	if (catMatch !== void 0 && (isListLike || catAtStart)) rest = rest.replace(catMatch.word, "");
	return {
		district,
		level,
		category: catMatch?.category,
		isListLike,
		rest: rest.trim()
	};
}
/**
* 原话兜底补齐：仅当 query 是「区域/级别/类别」组合查询（列表问法，或剥离后无剩余文本）时，
* 把识别到的区域/级别/办学类型补为结构化参数；显式参数优先、不覆盖。
* 校名类原话（如「沙田官立小学」剩余「官立」）不补齐，交由 detail 精确匹配。
*/
function enrichInput(input) {
	const q = (input.query ?? "").trim();
	if (!q) return input;
	const parsed = parseQueryText(q);
	if (!parsed.district && !parsed.level && !parsed.category) return input;
	if (!(parsed.isListLike || parsed.rest === "")) return input;
	const next = { ...input };
	if (!has(input.district) && parsed.district) next.district = parsed.district;
	if (input.level === void 0 && parsed.level) next.level = parsed.level;
	if (!has(input.schoolCategory) && parsed.category) next.schoolCategory = parsed.category;
	return next;
}
/** 人数/学位类信号词（含此类词则不视为学校数量问法） */
const PEOPLE_SIGNAL_RE = /学生|學生|人数|人數|学位|學位|学额|學額|教师|教師|班数|班數|空缺|学费|學費/;
/** 数量单位问法（多少所 / 几间 / 多少个） */
const COUNT_UNIT_RE = /(多少|幾多|几多|几|有幾|有几)\s*(所|間|间|个|個)/;
/** 数量 + 学校类名词问法（多少国际学校 / 多少小学） */
const COUNT_NOUN_RE = /(多少|幾多|几多)\s*(国际|國際|直资|直資|官立|政府|公立|私立|资助|資助|津贴|津貼|英基|学校|學校|小学|小學|中学|中學|幼稚园|幼稚園|幼儿园|幼兒園)/;
/**
* 学校数量问法识别：命中「多少所/几间/多少 XX 学校」且不含人数/学位类词时返回 true。
* 区分「沙田区有多少所小学」（学校数量）与「沙田区有多少中学生」（学生人数）。
*/
function isSchoolCountQuery(text) {
	const s = normalizeCjk((text ?? "").trim());
	if (!s) return false;
	if (PEOPLE_SIGNAL_RE.test(s)) return false;
	return COUNT_UNIT_RE.test(s) || COUNT_NOUN_RE.test(s);
}
/** 学生人数信号（供统计意图保护；不含学费/学位等非人数词） */
const STUDENT_COUNT_RE = /学生|學生|人数|人數/;
/**
* 学生人数问法识别（如「沙田区有多少中学生」「有多少学生」）。
* 与 isSchoolCountQuery 互斥：人数问法走 stats，学校数量问法走 search。
*/
function isStudentCountQuery(text) {
	const s = normalizeCjk((text ?? "").trim());
	return s !== "" && STUDENT_COUNT_RE.test(s);
}

//#endregion
//#region .build-temp/src/queries/detail.ts
/** 单元格清洗：剥离包裹引号（官方导出噪音）→ 空白与「-」归一为空串（未提供不编造）→ 剥离 HTML 标签并归一空白 */
function clean(v) {
	let s = (v ?? "").trim();
	if (s.length >= 2 && s.startsWith("\"") && s.endsWith("\"")) s = s.slice(1, -1).trim();
	if (s === "" || s === "-") return "";
	return s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function parseKgp(text) {
	const rows = parseCsvToObjects(text, { delimiter: "^" });
	const out = [];
	for (const row of rows) {
		const name = (row["學校名稱"] ?? "").trim();
		if (!name) continue;
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			schoolNo: clean(row["學校編號"]),
			district: clean(row["地區"]),
			joinsScheme: clean(row["參加幼稚園教育計劃"]),
			curriculum: clean(row["課程類別"]),
			applicationStart: clean(row["開始申請日期"]),
			applicationEnd: clean(row["結束申請日期"]),
			capacity: clean(row["已使用課室的總容額"]),
			teacherRatioAm: clean(row["上午時段師生比例"]),
			teacherRatioPm: clean(row["下午時段師生比例"]),
			feeHalfDay: clean(row["收費水平_全年_半日"]),
			feeWholeDay: clean(row["收費水平_全年_全日"]),
			website: clean(row["學校網址"]),
			totalTeachers: clean(row["校長及教學人員總人數"])
		});
	}
	return out;
}
function parseVacancy(text) {
	const rows = parseCsvToObjects(text, { delimiter: "," });
	const out = [];
	for (const row of rows) {
		const name = (row["School Chinese Name"] ?? "").trim();
		const nameEn = (row["School English Name"] ?? "").trim();
		if (!name && !nameEn) continue;
		out.push({
			name: name || nameEn,
			nameSimp: normalizeCjk(name),
			nameEn,
			district: (row["District"] ?? "").trim(),
			scrn: (row["SCRN"] ?? "").trim(),
			k1: (row["K1 Vacancy Status"] ?? "").trim(),
			k2: (row["K2 Vacancy Status"] ?? "").trim(),
			k3: (row["K3 Vacancy Status"] ?? "").trim(),
			asAtDate: (row["As At Date"] ?? "").trim()
		});
	}
	return out;
}
function parsePsp(text) {
	const rows = parseCsvToObjects(text, { delimiter: "," });
	const out = [];
	for (const row of rows) {
		const name = (row["學校名稱"] ?? "").trim();
		if (!name) continue;
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			district: clean(row["區域"]),
			schoolNet: clean(row["小一學校網"]),
			teachingLanguage: clean(row["教學語言"]),
			throughTrain: clean(row["一條龍中學"]),
			feeder: clean(row["直屬中學"]),
			nominated: clean(row["聯繫中學"]),
			fee: clean(row["學費"]),
			tongFee: clean(row["堂費"]),
			gender: clean(row["學生性別"]),
			religion: clean(row["宗教"]),
			motto: clean(row["校訓"]),
			sponsor: clean(row["辦學團體"]),
			foundedYear: clean(row["創校年份"]),
			category: clean(row["學校類別1"]),
			classStructure: {
				p1: clean(row["本學年小一班數"]),
				p2: clean(row["本學年小二班數"]),
				p3: clean(row["本學年小三班數"]),
				p4: clean(row["本學年小四班數"]),
				p5: clean(row["本學年小五班數"]),
				p6: clean(row["本學年小六班數"])
			},
			address: clean(row["學校地址"]),
			telephone: clean(row["學校電話"]),
			website: clean(row["學校網址"])
		});
	}
	return out;
}
function parseSsp(text) {
	const rows = parseCsvToObjects(text, { delimiter: "," });
	const out = [];
	for (const row of rows) {
		const name = (row["學校名稱"] ?? "").trim();
		if (!name) continue;
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			district: clean(row["區域"]),
			mission: clean(row["辦學宗旨"]),
			teacherCount: clean(row["教師總人數"]),
			approvedPosts: clean(row["核准編制教師職位數目"]),
			classStructure: {
				s1: clean(row["本學年中一班數"]),
				s2: clean(row["本學年中二班數"]),
				s3: clean(row["本學年中三班數"]),
				s4: clean(row["本學年中四班數"]),
				s5: clean(row["本學年中五班數"]),
				s6: clean(row["本學年中六班數"])
			},
			fees: {
				s1: clean(row["2025_2026學年學費S1"]),
				s2: clean(row["2025_2026學年學費S2"]),
				s3: clean(row["2025_2026學年學費S3"]),
				s4: clean(row["2025_2026學年學費S4"]),
				s5: clean(row["2025_2026學年學費S5"]),
				s6: clean(row["2025_2026學年學費S6"])
			},
			religion: clean(row["宗教"]),
			motto: clean(row["校訓"]),
			foundedYear: clean(row["創校年份"]),
			category: clean(row["學校類別"]),
			gender: clean(row["學生性別"]),
			facilities: clean(row["學校設施"]),
			classroomCount: clean(row["學校設施-課室數目"]),
			address: clean(row["學校地址"]),
			telephone: clean(row["學校電話"]),
			website: clean(row["學校網址"])
		});
	}
	return out;
}
/**
* 聚合学校档案：以校名匹配概览数据按级别挂载。
* - kg → KGP + K1-K3 空缺
* - primary → PSP
* - secondary → SSP
* - other（特殊学校）→ 无挂载
*/
function buildDetail(record, sources = {}) {
	const detail = {
		record,
		missing: []
	};
	const query = record.nameSimp || normalizeCjk(record.nameZh);
	if (record.level === "kg") {
		const kg = matchByName(sources.kgp, query);
		if (kg) detail.kg = kg;
		else detail.missing.push("幼稚园概览（参加计划情况、课程类别、学费、师生比例、学额、申请日期）官方数据未提供");
		const vac = matchByName(sources.vacancy, query);
		if (vac) detail.vacancy = {
			k1: vac.k1,
			k2: vac.k2,
			k3: vac.k3,
			asAtDate: vac.asAtDate
		};
		else detail.missing.push("K1-K3 学位空缺官方数据未提供");
	} else if (record.level === "primary") {
		const psp = matchByName(sources.psp, query);
		if (psp) detail.primary = psp;
		else detail.missing.push("小学概览（小一校网、教学语言、一条龙/直属/联系中学、班级结构、学费）官方数据未提供");
	} else if (record.level === "secondary") {
		const ssp = matchByName(sources.ssp, query);
		if (ssp) detail.secondary = ssp;
		else detail.missing.push("中学概览（班级结构、教师人数、办学宗旨、设施）官方数据未提供");
	}
	return detail;
}

//#endregion
//#region .build-temp/src/queries/list.ts
/** 文本字段清洗：跨行引号字段内的换行归一为空格（KG_SCHEME 美雅英文名实测）+ trim */
function cleanText(raw) {
	return (raw ?? "").replace(/\s*[\r\n]+\s*/g, " ").trim();
}
/** 数值清洗：去包裹引号、$、千分位逗号与空白；非法值 → 0 */
function toNumber(raw) {
	const s = (raw ?? "").replace(/[",$\s]/g, "");
	if (!s) return 0;
	const n = Number(s);
	return Number.isFinite(n) ? n : 0;
}
/** Y/N 标志解析（官方表格以 Y 表示是） */
function isYes(raw) {
	return (raw ?? "").trim().toUpperCase() === "Y";
}
/**
* 区域匹配（query 简繁均可）：
* - 「区」字可省略（「沙田」⇄「沙田區/沙田区」）
* - 兼容斜杠分隔的合并地区（如「荃灣/葵青」「元朗/天水圍」）
*/
function matchDistrict(recordDistrict, query) {
	const q = normalizeCjk((query ?? "").trim());
	if (!q) return false;
	const qq = q.endsWith("区") ? q.slice(0, -1) : q;
	if (!qq) return false;
	return normalizeCjk(recordDistrict ?? "").split("/").map((p) => p.trim()).map((p) => p.endsWith("区") ? p.slice(0, -1) : p).filter((p) => p !== "").some((p) => p === qq || qq.length >= 2 && p.includes(qq));
}
function parseThroughTrain(text) {
	const rows = parseCsv(text, { delimiter: "," });
	const out = [];
	for (let i = 1; i < rows.length; i++) {
		const name = cleanText(rows[i][1]);
		if (!name) continue;
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			groupNo: cleanText(rows[i][0]),
			district: cleanText(rows[i][2])
		});
	}
	return out;
}
/** 按校名查一条龙：命中返回整组（小学 + 中学）；未命中的空数组由调用层给明确回答 */
function findThroughTrain(list, name) {
	const hit = matchByName(list, normalizeCjk((name ?? "").trim()));
	if (!hit) return [];
	return list.filter((r) => r.groupNo === hit.groupNo);
}
/** 按区域过滤（「元朗」「元朗区」均可） */
function filterThroughTrainByDistrict(list, district) {
	return list.filter((r) => matchDistrict(r.district, district));
}
function parseDssFee(text) {
	const rows = parseCsv(text, { delimiter: "," });
	const out = [];
	for (let i = 1; i < rows.length; i++) {
		const name = cleanText(rows[i][1]);
		if (!name) continue;
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			no: cleanText(rows[i][0]),
			level: cleanText(rows[i][2]),
			classRange: cleanText(rows[i][3]),
			feeType: cleanText(rows[i][4]),
			feeMin: toNumber(rows[i][5]),
			feeMax: toNumber(rows[i][6])
		});
	}
	return out;
}
/** 按校名查直资学费（全部匹配：初小/中学同名一校多行全返回） */
function findDssFee(list, name) {
	return matchAllByName(list, normalizeCjk((name ?? "").trim()));
}
function parseKgScheme(text) {
	const rows = parseCsv(text, { delimiter: "	" });
	const out = [];
	for (let i = 1; i < rows.length; i++) {
		const name = cleanText(rows[i][1]);
		if (!name) continue;
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			no: cleanText(rows[i][0]),
			nameEn: cleanText(rows[i][2]),
			district: cleanText(rows[i][3]),
			districtEn: cleanText(rows[i][4])
		});
	}
	return out;
}
/** 按校名查幼教计划名单（全部匹配） */
function findKgScheme(list, name) {
	return matchAllByName(list, normalizeCjk((name ?? "").trim()));
}
/** 按区域过滤（「沙田」「沙田區」均可） */
function filterKgSchemeByDistrict(list, district) {
	return list.filter((r) => matchDistrict(r.district, district));
}
function parseK1NotJoining(text) {
	const rows = parseCsv(text, { delimiter: "," });
	const out = [];
	for (let i = 1; i < rows.length; i++) {
		const name = cleanText(rows[i][1]);
		if (!name) continue;
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			no: cleanText(rows[i][0]),
			address: cleanText(rows[i][2]),
			onlineApplication: isYes(rows[i][3]),
			oneVacancyOnly: isYes(rows[i][4]),
			shareVacancyInfo: isYes(rows[i][5])
		});
	}
	return out;
}
/** 按校名查 K1 非计划名单（全部匹配） */
function findK1NotJoining(list, name) {
	return matchAllByName(list, normalizeCjk((name ?? "").trim()));
}
function parseNonAidedCcc(text) {
	const rows = parseCsv(text, { delimiter: "," });
	const out = [];
	for (let i = 1; i < rows.length; i++) {
		const name = cleanText(rows[i][1]);
		if (!name) continue;
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			orgName: cleanText(rows[i][0]),
			address: cleanText(rows[i][2]),
			phone: cleanText(rows[i][3]),
			fax: cleanText(rows[i][4]),
			serviceType: cleanText(rows[i][5]),
			ageRange: cleanText(rows[i][6]),
			fullDayNurseryFee: toNumber(rows[i][7]),
			fullDayKgFee: toNumber(rows[i][8]),
			halfDayKgFee: toNumber(rows[i][9]),
			amFee: toNumber(rows[i][10]),
			pmFee: toNumber(rows[i][11]),
			halfDayType: cleanText(rows[i][12]),
			remarks: cleanText(rows[i][13]),
			nurseryCapacity: toNumber(rows[i][14]),
			kgCapacity: toNumber(rows[i][15]),
			halfDayCapacity: toNumber(rows[i][16]),
			district: cleanText(rows[i][17])
		});
	}
	return out;
}
/** 按中心名查附设幼儿中心（全部匹配） */
function findNonAidedCcc(list, name) {
	return matchAllByName(list, normalizeCjk((name ?? "").trim()));
}
/**
* 按地区过滤：
* - 地区列匹配（「荃灣」命中「荃灣/葵青」；「區」字可省略）
* - 地区列为粗分桶（如「元朗」含天水圍），地区列无命中时回退地址包含（支持新市镇地名）
*/
function filterNonAidedCccByDistrict(list, district) {
	const byDistrict = list.filter((r) => matchDistrict(r.district, district));
	if (byDistrict.length > 0) return byDistrict;
	const q = normalizeCjk((district ?? "").trim());
	if (q.length < 2) return [];
	return list.filter((r) => normalizeCjk(r.address).includes(q));
}

//#endregion
//#region .build-temp/src/queries/net.ts
/** 小学 36 校网 → 区域英文名（教育局小一校网划分；一区可含多个网） */
const POA_DISTRICT_MAP = {
	"11": "CENTRAL AND WESTERN",
	"12": "WAN CHAI",
	"14": "EASTERN",
	"16": "EASTERN",
	"18": "SOUTHERN",
	"31": "YAU TSIM MONG",
	"32": "YAU TSIM MONG",
	"34": "KOWLOON CITY",
	"35": "KOWLOON CITY",
	"40": "SHAM SHUI PO",
	"41": "KOWLOON CITY",
	"43": "WONG TAI SIN",
	"45": "WONG TAI SIN",
	"46": "KWUN TONG",
	"48": "KWUN TONG",
	"62": "TSUEN WAN",
	"64": "KWAI TSING",
	"65": "KWAI TSING",
	"66": "KWAI TSING",
	"70": "TUEN MUN",
	"71": "TUEN MUN",
	"72": "YUEN LONG",
	"73": "YUEN LONG",
	"74": "YUEN LONG",
	"80": "NORTH",
	"81": "NORTH",
	"83": "NORTH",
	"84": "TAI PO",
	"88": "SHA TIN",
	"89": "SHA TIN",
	"91": "SHA TIN",
	"95": "SAI KUNG",
	"96": "ISLANDS",
	"97": "ISLANDS",
	"98": "ISLANDS",
	"99": "ISLANDS"
};
/** SSPA DIST 分区代码 → 区域英文名（注意 KwT=葵青，与 KT=观塘 区分） */
const DIST_CODE_MAP = {
	CW: "CENTRAL AND WESTERN",
	WCH: "WAN CHAI",
	HKE: "EASTERN",
	SOU: "SOUTHERN",
	YTM: "YAU TSIM MONG",
	SSP: "SHAM SHUI PO",
	KC: "KOWLOON CITY",
	WTS: "WONG TAI SIN",
	KT: "KWUN TONG",
	KwT: "KWAI TSING",
	TW: "TSUEN WAN",
	TM: "TUEN MUN",
	YL: "YUEN LONG",
	N: "NORTH",
	TP: "TAI PO",
	ST: "SHA TIN",
	SK: "SAI KUNG",
	I: "ISLANDS"
};
/** 区域英文名 → 简体中文名（18 区仅在 DISTRICTS 中定义一次） */
function toZh(en) {
	if (!en) return void 0;
	return DISTRICTS.find((d) => d.en === en)?.zh;
}
function parsePoa(text) {
	const rows = parseCsvToObjects(text, { delimiter: "," });
	const out = [];
	for (const row of rows) {
		const net = (row["SCHOOLNET"] ?? "").trim();
		if (!net) continue;
		out.push({
			net,
			area: (row["AREA"] ?? "").trim(),
			webpage: (row["WEBPAGE"] ?? "").trim(),
			districtZh: toZh(POA_DISTRICT_MAP[net]) ?? ""
		});
	}
	return out;
}
/** 按网编号查小一校网 */
function findPoaByNet(list, net) {
	const key = (net ?? "").trim();
	if (!key) return void 0;
	return list.find((p) => p.net === key);
}
/**
* 按区域查询小一校网：
* ① 区域名（18 区，如「沙田」「Sha Tin」）→ 返回该区全部校网（一区可含多个网）；
* ② 地名关键词（如「將軍澳」）→ 与覆盖区域文本包含匹配（简繁容错）。
*/
function searchPoaByArea(list, input) {
	const s = (input ?? "").trim();
	if (!s) return [];
	const district = resolveDistrict(s);
	if (district) return list.filter((p) => POA_DISTRICT_MAP[p.net] === district.en);
	const key = normalizeCjk(s).toLowerCase();
	return list.filter((p) => normalizeCjk(p.area).toLowerCase().includes(key));
}
/** 18 个派位校网列（表头顺序） */
const SSPA_NET_COLS = [
	"HK1",
	"HK2",
	"HK3",
	"HK4",
	"KL1",
	"KL2",
	"KL3",
	"KL4",
	"KL5",
	"NT1",
	"NT2",
	"NT3",
	"NT4",
	"NT5",
	"NT6",
	"NT7",
	"NT8",
	"NT9"
];
function parseSspa(text) {
	const rows = parseCsvToObjects(text, { delimiter: "," });
	const out = [];
	for (const row of rows) {
		const name = (row["SCH_NAME"] ?? "").trim();
		if (!name) continue;
		const dist = (row["DIST"] ?? "").trim();
		out.push({
			name,
			nameSimp: normalizeCjk(name),
			net: (row["Net"] ?? "").trim(),
			dist,
			schCode: (row["Sch Code"] ?? "").trim(),
			servedNets: SSPA_NET_COLS.filter((col) => (row[col] ?? "").trim().toUpperCase() === "Y"),
			districtZh: toZh(DIST_CODE_MAP[dist]) ?? ""
		});
	}
	return out;
}
/** 按校名查中学派位校网（简繁归一：精确 → 双向包含） */
function findSspaByName(list, name) {
	return matchByName(list, normalizeCjk((name ?? "").trim()));
}
/** 按网反查：服务该网的全部中学（按表内顺序） */
function findSspaByNet(list, net) {
	const key = (net ?? "").trim().toUpperCase();
	if (!key) return [];
	return list.filter((r) => r.servedNets.includes(key));
}

//#endregion
//#region .build-temp/src/queries/nearby.ts
/** nearest-schools API 返回条数上限（官方限制） */
const NEARBY_MAX_LIMIT = 20;
const DEFAULT_NEARBY_MAX = 10;
/** 构造 nearest-schools 查询 URL（max 夹取到 1–20） */
function buildNearbyUrl(lat, lng, max = DEFAULT_NEARBY_MAX) {
	return `${NEAREST_SCHOOLS_API}?lat=${lat}&long=${lng}&max=${Math.min(20, Math.max(1, Math.floor(max)))}`;
}
/** 两坐标点球面距离（米，haversine） */
function haversineMeters(lat1, lng1, lat2, lng2) {
	const R = 6371008.8;
	const toRad = (d) => d * Math.PI / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
}
/**
* 解析 nearest-schools 响应：按（校名 + 地址）去重合并同校多班次记录，
* 计算与锚点的距离；坏记录（缺坐标/缺名）跳过。
*/
function parseNearestResponse(json, anchor, options = {}) {
	const results = json?.results;
	if (!Array.isArray(results)) return [];
	const merged = /* @__PURE__ */ new Map();
	for (const item of results) {
		if (item === null || typeof item !== "object") continue;
		const raw = item;
		const coord = parseLatLong(raw["lat-long"]);
		if (!coord) continue;
		const level = normalizeLevel(str(raw["level-en"]));
		if (options.level !== void 0 && level !== options.level) continue;
		const name = normalizeCjk(str(raw["name-zh"])) || str(raw["name-en"]);
		if (!name) continue;
		const address = normalizeCjk(str(raw["address-zh"])) || str(raw["address-en"]);
		const key = `${name}|${address}`;
		let entry = merged.get(key);
		if (!entry) {
			entry = {
				school: {
					name,
					nameEn: str(raw["name-en"]),
					level,
					category: normalizeCjk(str(raw["category-zh"])) || str(raw["category-en"]),
					district: normalizeCjk(str(raw["district-zh"])) || str(raw["district-en"]),
					address,
					telephone: str(raw.telephone),
					website: str(raw.website),
					sessions: [],
					distanceMeters: Math.round(haversineMeters(anchor.lat, anchor.lng, coord[0], coord[1]))
				},
				sessions: /* @__PURE__ */ new Set()
			};
			merged.set(key, entry);
		}
		const session = normalizeCjk(str(raw["session-zh"])) || str(raw["session-en"]);
		if (session) entry.sessions.add(session);
	}
	return [...merged.values()].map((e) => ({
		...e.school,
		sessions: [...e.sessions]
	}));
}
/**
* 查询附近学校（实时接口，不缓存）。
* 数据服务失败时抛出可操作中文错误。
*/
async function queryNearbySchools(options) {
	const { anchor, max, level, fetchJson = defaultFetchJson } = options;
	const url = buildNearbyUrl(anchor.lat, anchor.lng, max);
	let json;
	try {
		json = await fetchJson(url);
	} catch (cause) {
		throw new Error("附近学校查询失败：香港教育局数据服务暂时无法访问，请稍后重试，或改按「区域 + 学校类型」搜索。", { cause });
	}
	return parseNearestResponse(json, anchor, { level });
}
/** 默认 JSON 获取（30 秒超时；HTTP 非 2xx 抛错） */
const defaultFetchJson = async (url) => {
	const res = await fetch(url, { signal: AbortSignal.timeout(3e4) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return res.json();
};
/** 字段收窄：非字符串或空串 → '' */
const str = (v) => typeof v === "string" ? v.trim() : "";
/** `lat-long` 数组 [lat, lng] 解析（缺值/越界 → undefined） */
function parseLatLong(v) {
	if (!Array.isArray(v) || v.length < 2) return void 0;
	const lat = Number(v[0]);
	const lng = Number(v[1]);
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return void 0;
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return void 0;
	return [lat, lng];
}

//#endregion
//#region .build-temp/src/tool.ts
/** 生产缓存目录（插件容器 /tmp；测试注入临时目录） */
const DEFAULT_CACHE_DIR = "/tmp/lugang-school-finder";
/**
* 工具主入口：推断意图 → 执行 → 追加过期提示。
* 所有异常收敛为可操作中文错误（error + 防重试 tips），不向模型抛裸栈。
*/
async function runTool(input, deps = {}) {
	const enriched = enrichInput(input);
	const intent = inferIntent(enriched);
	if (!intent) return guidanceResult();
	const fetcher = createFetcher({
		cacheDir: deps.cacheDir ?? "/tmp/lugang-school-finder",
		fetchBytes: deps.fetchBytes,
		now: deps.now
	});
	const stale = { stale: false };
	try {
		const result = await runIntent(intent, enriched, fetcher, stale, deps);
		if (stale.stale) result.tips.push(TIP_STALE);
		return result;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return buildToolResult({
			summary: `香港学校资料查询未完成：${message}`,
			error: message,
			tips: [TIP_NO_RETRY_ERROR]
		});
	}
}
async function loadText(sourceId, fetcher, stale) {
	return decodeBytes(await loadBytes(sourceId, fetcher, stale));
}
async function loadBytes(sourceId, fetcher, stale) {
	const r = await fetcher.get(getSource(sourceId));
	if (r.stale) stale.stale = true;
	return r.data;
}
/** 可选源加载：失败返回 undefined（由 format 层以「官方数据未提供」标注，不编造） */
async function loadOptional(load) {
	try {
		return await load();
	} catch {
		return;
	}
}
async function runIntent(intent, input, fetcher, stale, deps) {
	switch (intent) {
		case "nearby": return runNearby(input, fetcher, stale, deps);
		case "search": return runSearch(input, fetcher, stale);
		case "detail": return runDetail(input, fetcher, stale);
		case "net": return runNet(input, fetcher, stale);
		case "list": return runList(input, fetcher, stale);
		case "stats": return runStats(input, fetcher, stale);
		case "registration": return runRegistration(input, fetcher, stale);
	}
}
/** 附近学校：地点 → 坐标锚点（坐标文本/地标/18 区/校名兜底）→ 实时接口 → 格式化 */
async function runNearby(input, fetcher, stale, deps) {
	const raw = (input.location ?? input.query ?? "").trim();
	if (!raw) return askFor("附近学校查询需要地点（如「尖沙咀」「沙田」或「纬度,经度」坐标）");
	let anchor = resolveLocation(raw);
	if (!anchor) anchor = resolveLocation(raw, parseSchLoc(await loadText("sch_loc", fetcher, stale)));
	if (!anchor) return buildToolResult({
		summary: `无法识别地点「${normalizeCjk(raw)}」。请提示用户改用 18 区区域名（如「沙田区」）、地标名（如「尖沙咀」），或直接提供「纬度,经度」坐标。`,
		tips: [TIP_NO_RETRY_EMPTY]
	});
	return formatNearby(await queryNearbySchools({
		anchor,
		level: input.level,
		fetchJson: deps.fetchJson
	}), anchor.label);
}
/** 鲁港通 - 组合词条件解析：整句可拆为「区域/级别/办学类型」且剩余仅为类别修饰词时返回结构化条件
* （如「油尖旺区直资中学」→ 区域+级别+直资；「喇沙书完」等校名类返回 undefined） */
function comboConditions(text) {
	const parsed = parseQueryText(text);
	if (!parsed.district && !parsed.level && !parsed.category) return void 0;
	const catWord = matchCategoryWord(text)?.word;
	if (parsed.rest !== "" && (catWord === void 0 || parsed.rest !== catWord)) return void 0;
	return {
		district: parsed.district,
		level: parsed.level,
		schoolCategory: parsed.category
	};
}
/** 学校搜索：校名关键词 / 区域 / 级别 / 办学类型（显式校名优先；query 已解析为条件时不再当校名） */
async function runSearch(input, fetcher, stale) {
	const district = (input.district ?? "").trim();
	const category = normalizeCategory(input.schoolCategory ?? "");
	const rawQuery = (input.query ?? "").trim();
	const parsedQ = rawQuery ? parseQueryText(rawQuery) : void 0;
	const consumed = Boolean((input.schoolName ?? "").trim() === "" && parsedQ !== void 0 && (parsedQ.district || parsedQ.level || parsedQ.category) && (parsedQ.isListLike || parsedQ.rest === ""));
	const name = (input.schoolName ?? (consumed ? "" : rawQuery) ?? "").trim();
	if (!name && !district && input.level === void 0 && !category) return askFor("学校搜索需要校名关键词、区域、学校级别或办学类型（如「沙田区小学」「油尖旺区直资中学」）");
	const result = searchSchools(parseSchLoc(await loadText("sch_loc", fetcher, stale)), {
		name: name || void 0,
		district: district || void 0,
		level: input.level,
		category
	});
	if (name && result.total === 0) {
		const combo = comboConditions(name);
		if (combo) return runSearch({
			district: district || combo.district,
			level: input.level ?? combo.level,
			schoolCategory: (input.schoolCategory ?? "").trim() || combo.schoolCategory
		}, fetcher, stale);
	}
	return formatSearch(result, {
		name: name || void 0,
		district: district || void 0,
		level: input.level,
		category
	});
}
/** 学校档案：精确校名（SCH_LOC）→ 未精确时按搜索候选给出；按级别挂载概览源（单源失败降级） */
async function runDetail(input, fetcher, stale) {
	const name = (input.schoolName ?? input.query ?? "").trim();
	if (!name) return askFor("学校档案查询需要校名（如「喇沙书院」）");
	const records = parseSchLoc(await loadText("sch_loc", fetcher, stale));
	const norm = normalizeCjk(name);
	const lower = name.toLowerCase();
	let record = records.find((r) => r.nameSimp === norm || r.nameEn !== "" && r.nameEn.toLowerCase() === lower);
	if (!record) {
		const search = searchSchools(records, {
			name,
			level: input.level
		});
		if (search.total !== 1) {
			const combo = comboConditions(name);
			if (combo) return runSearch(combo, fetcher, stale);
			return formatSearch(search, { name });
		}
		record = search.items[0];
	}
	const sources = {};
	if (record.level === "kg") {
		sources.kgp = await loadOptional(async () => parseKgp(await loadText("kgp", fetcher, stale)));
		sources.vacancy = await loadOptional(async () => parseVacancy(await loadText("k1k3_vacancy", fetcher, stale)));
	} else if (record.level === "primary") sources.psp = await loadOptional(async () => parsePsp(await loadText("psp", fetcher, stale)));
	else if (record.level === "secondary") sources.ssp = await loadOptional(async () => parseSsp(await loadText("ssp", fetcher, stale)));
	return formatDetail(buildDetail(record, sources));
}
/** 校网：poa（按区域/网编号）/ sspa（按校名/网编号） */
async function runNet(input, fetcher, stale) {
	const type = input.netType ?? (input.schoolName ? "sspa" : void 0);
	if (type === "poa") {
		const raw = (input.district ?? input.query ?? input.location ?? "").trim();
		if (!raw) return askFor("小一校网查询需要区域名（如「沙田区」）或网编号（如「95」）");
		const list = parsePoa(await loadText("poa", fetcher, stale));
		if (/^\d{1,2}$/.test(raw)) {
			const hit = findPoaByNet(list, raw);
			return formatNetPoa(hit ? [hit] : [], raw);
		}
		return formatNetPoa(searchPoaByArea(list, raw), raw);
	}
	if (type === "sspa") {
		const name = (input.schoolName ?? "").trim();
		const list = parseSspa(await loadText("sspa", fetcher, stale));
		if (name) return formatNetSspaSchool(findSspaByName(list, name), name);
		const raw = (input.query ?? "").trim();
		const token = /(?:HK|KL|NT)\s*\d/i.exec(raw);
		if (token) {
			const net = token[0].replace(/\s+/g, "").toUpperCase();
			return formatNetSspaNet(findSspaByNet(list, net), net);
		}
		if (raw) return formatNetSspaSchool(findSspaByName(list, raw), raw);
		return askFor("中学派位校网查询需要校名（如「喇沙书院」）或校网编号（如「HK1」）");
	}
	return askFor("校网查询需要说明类型：小一学校网（poa）或中学派位校网（sspa）");
}
/** 名单来源映射（五类 listType → 数据源 id） */
const LIST_SOURCE_ID = {
	through_train: "through_train",
	dss_fee: "dss_fee",
	kg_scheme: "kg_scheme",
	k1_not_joining: "k1_not_joining",
	non_aided_ccc: "non_aided_ccc"
};
/** 鲁港通 - 名单类型兜底识别（原话关键词 → listType；仅在未显式传 listType 时使用） */
const LIST_TYPE_TRIGGERS = [
	[/一条龙/, "through_train"],
	[/k1\s*收生|收生安排/, "k1_not_joining"],
	[/非资助.*幼儿中心|附设.*幼儿中心/, "non_aided_ccc"],
	[/免费优质|幼稚园教育计划|学券/, "kg_scheme"],
	[/直资.*学费|学费表|收费表/, "dss_fee"]
];
function inferListTypeFromText(text) {
	const s = normalizeCjk((text ?? "").trim());
	if (!s) return void 0;
	for (const [re, type] of LIST_TYPE_TRIGGERS) if (re.test(s)) return type;
}
/** 鲁港通 - 学费语义信号（原话含学费/收费字样时，dss_fee 名单逻辑优先，不做列校纠偏） */
const FEE_WORD_RE = /学费|收費|收费/;
/**
* 鲁港通 - 名单纠偏判定：原话是否为「区域/级别/办学类型」清单问法（与 enrichInput 补齐口径一致）。
* 用于模型误把「某区有哪些直资中学」映射为 dss_fee（直资学费名单）时降级为学校列表。
*/
function isConditionListQuery(parsed) {
	if (!parsed) return false;
	if (!(parsed.isListLike || parsed.rest === "")) return false;
	return Boolean(parsed.district || parsed.level || parsed.category);
}
/** 名单查询：按类型取源 → 校名或区域过滤（不支持区域的类型给明确提示；未给类型时先兜底识别/降级列校） */
async function runList(input, fetcher, stale) {
	const rawQuery = (input.query ?? "").trim();
	const inferred = input.listType ?? inferListTypeFromText(rawQuery);
	if (!inferred) {
		const parsed = rawQuery ? parseQueryText(rawQuery) : void 0;
		if (parsed && (parsed.district || parsed.level || parsed.category)) return runSearch(input, fetcher, stale);
		return askFor("未能确定名单类型（一条龙 / 直资学费 / 免费幼教计划 / K1 非计划 / 附设幼儿中心）；若为普通列校问题请补充区域/级别/办学类型");
	}
	const type = inferred;
	const parsedQ = rawQuery ? parseQueryText(rawQuery) : void 0;
	const queryIsName = parsedQ === void 0 || !parsedQ.isListLike && !parsedQ.district && !parsedQ.level && !parsedQ.category;
	const name = (input.schoolName ?? (queryIsName ? rawQuery : "") ?? "").trim();
	const district = (input.district ?? "").trim();
	const text = await loadText(LIST_SOURCE_ID[type], fetcher, stale);
	switch (type) {
		case "through_train": {
			const list = parseThroughTrain(text);
			if (name) return formatList({
				type,
				queryName: name,
				records: findThroughTrain(list, name)
			});
			if (district) return formatList({
				type,
				district,
				records: filterThroughTrainByDistrict(list, district)
			});
			return askFor("一条龙名单查询需要校名或区域（如「沙田」）");
		}
		case "dss_fee": {
			if (!name && !FEE_WORD_RE.test(normalizeCjk(rawQuery)) && isConditionListQuery(parsedQ)) return runSearch(input, fetcher, stale);
			const list = parseDssFee(text);
			if (name) return formatList({
				type,
				queryName: name,
				records: findDssFee(list, name)
			});
			return askFor("直资学费查询需要校名（该名单不支持按区域筛选）");
		}
		case "kg_scheme": {
			const list = parseKgScheme(text);
			if (name) return formatList({
				type,
				queryName: name,
				records: findKgScheme(list, name)
			});
			if (district) return formatList({
				type,
				district,
				records: filterKgSchemeByDistrict(list, district)
			});
			return askFor("幼教计划名单查询需要校名或区域（如「沙田」）");
		}
		case "k1_not_joining": {
			const list = parseK1NotJoining(text);
			if (name) return formatList({
				type,
				queryName: name,
				records: findK1NotJoining(list, name)
			});
			return askFor("K1 收生安排名单查询需要校名（该名单不支持按区域筛选）");
		}
		case "non_aided_ccc": {
			const list = parseNonAidedCcc(text);
			if (name) return formatList({
				type,
				queryName: name,
				records: findNonAidedCcc(list, name)
			});
			if (district) return formatList({
				type,
				district,
				records: filterNonAidedCccByDistrict(list, district)
			});
			return askFor("附设幼儿中心查询需要校名或地区（如「荃湾」）");
		}
	}
}
/** 统计：学校数量问法（「有多少所 XX 学校」）→ 转搜索；否则学生人数统计（官方 XLSX「表3(b)」） */
async function runStats(input, fetcher, stale) {
	const raw = (input.query ?? "").trim();
	if (raw && isSchoolCountQuery(raw)) return runSearch(input, fetcher, stale);
	const stats = parseStudentStatsFromXlsx(await loadBytes("tab0407", fetcher, stale));
	const zone = (input.district ?? input.query ?? "").trim();
	return formatStats(stats, zone ? { zone } : { compare: true });
}
/** 注册资料：XML 三件套并行下载 → 解析 → 按校名聚合 */
async function runRegistration(input, fetcher, stale) {
	const name = (input.schoolName ?? input.query ?? "").trim();
	if (!name) return askFor("注册资料查询需要校名（如「喇沙书院」）");
	const [basicXml, premisesXml, roomsXml] = await Promise.all([
		loadText("reg_basic", fetcher, stale),
		loadText("reg_premises", fetcher, stale),
		loadText("reg_accommodation", fetcher, stale)
	]);
	return formatRegistration(findRegistration(parseRegBasic(basicXml), parseRegPremises(premisesXml), parseRegAccommodation(roomsXml), name), name);
}
function askFor(detail) {
	return buildToolResult({
		summary: `查询信息不足：${detail}。请向用户补充询问后再调用本工具。`,
		tips: ["请先与用户确认具体查询对象后重新调用。"]
	});
}
function guidanceResult() {
	return buildToolResult({
		summary: "未能确定查询类型。请补充查询信息：校名（如「喇沙书院」）、区域+学校级别（如「沙田区小学」）、地点（如「尖沙咀」附近）、名单类型（一条龙 / 直资学费 / 幼教计划 / K1 非计划 / 附设幼儿中心）、校网（poa / sspa）或统计区域。",
		tips: ["请先与用户确认查询对象后重新调用。"]
	});
}

//#endregion
//#region .build-temp/index.ts
const handler = createToolHandler({
	inputSchema: object({
		query: string().optional().meta({
			title: "用户问题（兜底）",
			description: "用户原始问题文本；未提取到结构化参数时从此文本兜底解析",
			toolDescription: "用户的原始问题文本，如「沙田区有哪些小学」「喇沙书院学费多少」。当未提取出其他参数时由插件兜底解析",
			isToolParam: true
		}),
		intent: _enum([
			"nearby",
			"search",
			"detail",
			"net",
			"list",
			"stats",
			"registration"
		]).optional().meta({
			title: "查询意图",
			description: "缺省按参数组合自动推断",
			toolDescription: "查询类型：nearby(附近学校)/search(按条件搜校，含按区域/级别/办学类型列校与学校数量统计)/detail(学校档案)/net(校网)/list(五类专项名单)/stats(学生人数统计，仅限「有多少学生/多少人」类问题)/registration(注册资料)。不填则自动推断",
			isToolParam: true
		}),
		schoolName: string().optional().meta({
			title: "校名",
			description: "学校名称（简体/繁体皆可），如「喇沙书院」「沙田官立小学」",
			toolDescription: "要查询的学校名称，简繁皆可。用于学校档案、校名反查、名单与注册资料查询",
			isToolParam: true
		}),
		district: string().optional().meta({
			title: "区域",
			description: "香港 18 区区域名（如「沙田区」「元朗」；英文亦可）",
			toolDescription: "香港 18 区区域名，如「沙田区」「湾仔」「元朗」。用于按区域搜索、名单过滤、统计查询",
			isToolParam: true
		}),
		level: _enum([
			"kg",
			"primary",
			"secondary"
		]).optional().meta({
			title: "学校级别",
			description: "学校类型：kg(幼稚园) / primary(小学) / secondary(中学)",
			toolDescription: "学校类型：kg(幼稚园)/primary(小学)/secondary(中学)。用于过滤搜索结果与学校档案",
			isToolParam: true
		}),
		schoolCategory: _enum([
			"international",
			"direct_subsidy",
			"government",
			"aided",
			"private",
			"esf"
		]).optional().meta({
			title: "办学类型",
			description: "办学类型：international(国际学校) / direct_subsidy(直资) / government(官立) / aided(资助) / private(私立) / esf(英基)",
			toolDescription: "办学类型过滤：international(国际学校)/direct_subsidy(直资)/government(官立)/aided(资助)/private(私立)/esf(英基)。用于「某区有哪些直资中学」「全港有多少所国际学校」等列校与数量问题",
			isToolParam: true
		}),
		location: string().optional().meta({
			title: "地点",
			description: "地点/坐标（附近学校查询用），如「尖沙咀」「22.2988,114.1722」",
			toolDescription: "查询附近学校的地点：可传 18 区名、地标名（如「尖沙咀」）、校名，或「纬度,经度」坐标",
			isToolParam: true
		}),
		listType: _enum([
			"through_train",
			"dss_fee",
			"kg_scheme",
			"k1_not_joining",
			"non_aided_ccc"
		]).optional().meta({
			title: "名单类型",
			description: "五类名单：一条龙 / 直资学费 / 幼教计划 / K1 非计划 / 附设幼儿中心",
			toolDescription: "五类专项名单（仅当用户明确问这些名单时用）：through_train(一条龙)/dss_fee(直资学费)/kg_scheme(免费幼教计划)/k1_not_joining(K1 非计划)/non_aided_ccc(附设幼儿中心)。「某区有哪些小学/直资中学」等普通列校问题请改用 search 意图",
			isToolParam: true
		}),
		netType: _enum(["poa", "sspa"]).optional().meta({
			title: "校网类型",
			description: "poa(小一入学学校网) / sspa(中学学位分配校网)",
			toolDescription: "校网类型：poa(小一入学学校网，按区域或 2 位网编号)/sspa(中学派位校网，按校名或 HK1–NT9 编号)",
			isToolParam: true
		}),
		language: _enum([
			"zh-CN",
			"zh-HK",
			"en"
		]).optional().meta({
			title: "语言",
			description: "返回数据语言，输出统一为简体中文（保留参数兼容）",
			toolDescription: "返回数据语言：zh-CN(简体)/zh-HK(繁体)/en(英文)。不填默认 zh-CN"
		})
	}),
	outputSchema: object({
		summary: string().meta({
			title: "答案摘要",
			description: "预格式化的简体中文摘要（LLM 直接引用即可，数字均来自官方数据）"
		}),
		items: array(object({
			name: string().optional(),
			nameEn: string().optional(),
			level: string().optional(),
			district: string().optional(),
			address: string().optional(),
			telephone: string().optional(),
			website: string().optional(),
			distanceMeters: number().optional(),
			extra: record(string(), union([
				string(),
				number(),
				array(string())
			])).optional()
		})).meta({
			title: "结构化条目",
			description: "结构化结果条目（学校/名单/统计行等）"
		}),
		dataDate: string().meta({
			title: "数据日期",
			description: "数据日期/学年（如「2026/27 学年」「实时数据」）"
		}),
		sources: array(string()).meta({
			title: "数据来源",
			description: "来源标注（政府官方数据集）"
		}),
		tips: array(string()).meta({
			title: "提示",
			description: "数据更新节奏、防重试、数据边界等提示"
		}),
		error: string().optional().meta({
			title: "错误信息",
			description: "查询失败时的可操作中文说明"
		})
	}),
	handler: async (input) => runTool(input)
});
var _build_temp_default = defineTool({
	manifest: {
		pluginId: "hk_school_finder",
		version: "1.1.1",
		name: {
			en: "HK School Finder",
			"zh-CN": "香港学校资料助手",
			"zh-Hant": "香港學校資料助手"
		},
		description: {
			en: "[MUST invoke for ALL HK school questions] Official data for all HK kindergartens, primary and secondary schools — locations, profiles, class structure, fees, through-train status, POA/SSPA school nets, kindergarten scheme lists, DSS fees, K1-K3 vacancies, district student statistics, school registration records.",
			"zh-CN": "【必须对任何香港学校问题调用此工具】查询全港幼稚园、小学、中学的官方资料——学校位置与列表、学校档案（学费/班级/教师/校训）、一条龙关系、小一与中学校网（POA/SSPA）、免费幼教计划与 K1 收生名单、直资学费、学位空缺、分区学生人数统计、学校注册资料。数据来自教育局和家庭与学校合作事宜委员会官方发布。",
			"zh-Hant": "【必須對任何香港學校問題調用此工具】查詢全港幼稚園、小學、中學的官方資料——學校位置與列表、學校檔案（學費/班級/教師/校訓）、一條龍關係、小一與中學校網（POA/SSPA）、免費幼教計劃與 K1 收生名單、直資學費、學位空缺、分區學生人數統計、學校註冊資料。數據來自教育局和家庭與學校合作事宜委員會官方發布。"
		},
		toolDescription: "香港学校资料万能查询工具。当用户问「某学校怎么样/资料/学费/班数/教师」「附近有哪些学校」「某区有哪些小学/中学/幼稚园」「某区有哪些直资/国际学校」「全港/某区有多少所 XX 学校」「是不是一条龙」「某区学生人数」「学校注册资料」「校网/派位范围」「学位空缺」等任何香港学校问题时，必须调用此工具。优先传入结构化参数（校名 schoolName、区域 district、级别 level、办学类型 schoolCategory、地点 location、名单类型 listType、校网类型 netType）；仅有用户原话时传 query 兜底。\n【问法映射】「某区有哪些小学」「某区有哪些直资中学」等列校问题 → search + district/level/schoolCategory；「有多少所 XX 学校」等学校数量问题 → search（数量统计）；「有多少学生/中学生」等人数问题 → stats。\n【重要】不要重复调用本工具：同一问题返回空结果即表示官方名单/数据中确实没有记录，请直接告知用户；查询失败时按错误说明转达用户，重复调用无法改变结果。\n【边界】本工具只提供官方客观数据，不评价学校质量、不提供排名。",
		tags: ["tools"],
		author: "鲁港通 (Lugang Connect)",
		versionDescription: {
			en: "Fix: «which DSS schools are in district X» was misrouted to the DSS-fee list requiring a school name; now answered as a school list in one step",
			"zh-CN": "修复：「某区有哪些直资中学」被误判为直资学费名单（要求补校名）的问题；现按学校列表一步到位回答",
			"zh-Hant": "修復：「某區有哪些直資中學」被誤判為直資學費名單（要求補校名）的問題；現按學校列表一步到位回答"
		}
	},
	handler
});

//#endregion
export { _build_temp_default as default };