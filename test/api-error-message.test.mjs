import assert from "node:assert/strict";
import test from "node:test";
import { AxiosError, AxiosHeaders } from "axios";
import { preferApiErrorMessage } from "../src/shared/utils/api-error-message.ts";

const responseError = (status, data) => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(`Request failed with status code ${status}`, "ERR_BAD_REQUEST", config, undefined, {
    status,
    statusText: "Bad Request",
    headers: {},
    config,
    data,
  });
};

test("uses the backend message while preserving the Axios response", () => {
  const error = responseError(400, { error: "Ya existe un cliente con ese correo." });
  assert.equal(preferApiErrorMessage(error), error);
  assert.equal(error.message, "Ya existe un cliente con ese correo.");
  assert.equal(error.response.status, 400);
});

test("keeps the 409 payload used to confirm a shared phone", () => {
  const error = responseError(409, { code: "SHARED_CUSTOMER_PHONE", error: "Confirma el número.", phones: ["+525541142762"] });
  preferApiErrorMessage(error);
  assert.equal(error.response.data.code, "SHARED_CUSTOMER_PHONE");
  assert.deepEqual(error.response.data.phones, ["+525541142762"]);
});

test("retains a useful fallback when the API did not send a message", () => {
  const networkError = new AxiosError("Network Error", "ERR_NETWORK");
  preferApiErrorMessage(networkError);
  assert.equal(networkError.message, "Network Error");

  const unexpected = new Error("Otra falla");
  assert.equal(preferApiErrorMessage(unexpected), unexpected);
});
