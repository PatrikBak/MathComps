import type { Graph, Thing, WithContext } from 'schema-dts'

/**
 * Props for the {@link JsonLd} component.
 */
type JsonLdProps = {
  /** The schema.org graph, or a single node with its own context. */
  data: Graph | WithContext<Thing>
}

/**
 * Serializes structured data into a `<script type="application/ld+json">` element.
 */
export function JsonLd({ data }: JsonLdProps) {
  // Escape `<` so a stray `</script>` inside any string can't break out of the tag
  const json = JSON.stringify(data).replace(/</g, '\\u003c')

  // Emit the structured data
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
