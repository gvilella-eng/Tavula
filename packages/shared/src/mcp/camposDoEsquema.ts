import type { z } from "zod";

// Q16: lista os caminhos de campo de um esquema zod (com os objetos de dentro), para a trava de paridade por campo.
// `a.b` é o campo `b` do objeto `a`; `a[]` é a lista; `a[].b` é um campo do item; `a{}` é um mapa (record).

type Def = {
  type?: string;
  shape?: Record<string, z.ZodType>;
  innerType?: z.ZodType;
  element?: z.ZodType;
  options?: z.ZodType[];
  valueType?: z.ZodType;
  in?: z.ZodType;
  left?: z.ZodType;
  right?: z.ZodType;
  getter?: () => z.ZodType;
};

function def(s: z.ZodType): Def {
  return (s as unknown as { _zod: { def: Def } })._zod.def;
}

/** Os campos folha (e os objetos sem campos) de um esquema, como caminhos pontuados. */
export function camposDoEsquema(
  esquema: z.ZodType,
  prefixo = "",
  vistos: Set<unknown> = new Set(),
): string[] {
  const d = def(esquema);
  switch (d.type) {
    case "optional":
    case "nullable":
    case "default":
    case "prefault":
    case "readonly":
    case "nonoptional":
    case "catch":
      return camposDoEsquema(d.innerType as z.ZodType, prefixo, vistos);
    case "pipe":
      return camposDoEsquema(d.in as z.ZodType, prefixo, vistos);
    case "lazy": {
      if (vistos.has(esquema)) return prefixo ? [prefixo] : [];
      vistos.add(esquema);
      return camposDoEsquema((d.getter as () => z.ZodType)(), prefixo, vistos);
    }
    case "array":
      return camposDoEsquema(d.element as z.ZodType, `${prefixo}[]`, vistos);
    case "record":
      return camposDoEsquema(d.valueType as z.ZodType, `${prefixo}{}`, vistos);
    case "union": {
      const todos = new Set<string>();
      for (const o of d.options ?? [])
        for (const c of camposDoEsquema(o, prefixo, vistos)) todos.add(c);
      return [...todos];
    }
    case "intersection":
      return [
        ...new Set([
          ...camposDoEsquema(d.left as z.ZodType, prefixo, vistos),
          ...camposDoEsquema(d.right as z.ZodType, prefixo, vistos),
        ]),
      ];
    case "object": {
      const shape = d.shape ?? {};
      const chaves = Object.keys(shape);
      if (chaves.length === 0) return prefixo ? [prefixo] : [];
      const saida: string[] = [];
      for (const k of chaves) {
        saida.push(
          ...camposDoEsquema(shape[k] as z.ZodType, prefixo ? `${prefixo}.${k}` : k, vistos),
        );
      }
      return saida;
    }
    default:
      return prefixo ? [prefixo] : [];
  }
}
