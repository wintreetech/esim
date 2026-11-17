// Never POST customer details to a response-supplied origin outside the two
// exact TransactWorld hosted checkout endpoints.
export function validatePaymentRedirect(value: {
  url: string;
  method?: string;
  fields?: Record<string, string>;
}) {
  const url = new URL(value.url);
  if (
    url.username ||
    url.password ||
    url.protocol !== "https:" ||
    (url.port && url.port !== "443")
  )
    throw new Error("Invalid payment destination.");
  if (value.method === "POST") {
    if (
      !["sandbox.transactworld.com", "secure.transactworld.com"].includes(
        url.hostname,
      ) ||
      url.pathname !== "/transaction/Checkout" ||
      url.search ||
      url.hash ||
      !value.fields ||
      Object.entries(value.fields).some(
        ([key, field]) =>
          !/^[A-Za-z][A-Za-z0-9_.]*$/.test(key) ||
          typeof field !== "string" ||
          field.length > 4096,
      )
    )
      throw new Error("Invalid payment destination.");
  } else if (value.method || url.hostname !== "checkout.stripe.com")
    throw new Error("Invalid payment destination.");
  return url;
}
