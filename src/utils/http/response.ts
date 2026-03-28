type SuccessPayload<TData extends object> = {
  ok: true
} & TData

type ErrorPayload = {
  ok: false
  message: string
  details?: unknown
}

export const ok = <TData extends object>(data: TData): SuccessPayload<TData> => {
  return {
    ok: true,
    ...data,
  }
}

export const fail = (message: string, details?: unknown): ErrorPayload => {
  return {
    ok: false,
    message,
    ...(details === undefined ? {} : { details }),
  }
}
