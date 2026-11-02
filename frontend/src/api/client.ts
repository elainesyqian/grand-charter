// fetch wrapper: base "/api", credentials: "include", JSON in/out.
// Throws ApiError { status, detail }. On 401, clears auth state and sends the user to /login.
// Separate helper for multipart uploads.
