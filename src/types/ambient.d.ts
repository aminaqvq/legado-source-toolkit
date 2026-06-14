/**
 * Type declarations for modules that lack them.
 */

declare module 'xmldom' {
  import { DOMImplementation, DOMParser, XMLSerializer } from '@xmldom/xmldom';
  export { DOMImplementation, DOMParser, XMLSerializer };
}
