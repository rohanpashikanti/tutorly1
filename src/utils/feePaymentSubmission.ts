/** Runs UI success effects only after the server returns a complete payment result. */
export async function runConfirmedFeePayment<T>(
  submit: () => Promise<T>,
  isConfirmed: (response: T) => boolean,
  onConfirmed: (response: T) => void | Promise<void>,
): Promise<T> {
  const response = await submit();
  if (!isConfirmed(response)) {
    throw new Error('The server did not confirm that the payment was recorded.');
  }
  await onConfirmed(response);
  return response;
}
