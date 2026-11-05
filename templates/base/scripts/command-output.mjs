export function redactCommandOutput(value = '') {
  return value
    .replace(/("(?:ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|PUBLISHABLE_KEY|SECRET_KEY|DB_URL|S3_PROTOCOL_ACCESS_KEY_ID|S3_PROTOCOL_ACCESS_KEY_SECRET|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)"\s*:\s*)"(?:\\.|[^"\\\r\n])*"/gi, '$1"[redacted]"')
    .replace(/^(\s*(?:export\s+)?(?:ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|PUBLISHABLE_KEY|SECRET_KEY|DB_URL|S3_PROTOCOL_ACCESS_KEY_ID|S3_PROTOCOL_ACCESS_KEY_SECRET|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN)\s*=\s*)[^\r\n]*/gim, '$1[redacted]')
    .replace(/^([^\S\r\n]*(?:[|│]\s*)?(?:Access Key(?: ID)?|Secret Key|Secret Access Key)\s*[:|│]\s*)[^\r\n]*/gim, '$1[redacted]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, '$1[redacted]@');
}
