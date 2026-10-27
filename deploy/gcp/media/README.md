# ASSEMBLY demonstration film hosting

This isolated static service serves only the release-reviewed final MP4, poster
and WebVTT captions, with the release-approved narration transcript in the page. Its cream, ink and coral page has native playback controls,
optional English captions, downloads, and verified live-app/source links. It has
no database, VPC connection, provider credentials or application state. The existing
ASSEMBLY application and worker are not modified by this hosting recipe.

Publish only after release review has checked the final media and publication is
authorized. Never upload the film project, captures, plans, word-timing files, production notes
or raw provider data. Only the clean, approved narration transcript belongs in
the public player and [transcript document](../../../DEMO-TRANSCRIPT.md). Prepare a new private build directory outside
the repository using explicit file paths and verified public URLs:

```sh
python3 deploy/gcp/media/prepare.py \
  --video /absolute/path/to/ASSEMBLY-demo.mp4 \
  --poster /absolute/path/to/ASSEMBLY-poster.png \
  --captions /absolute/path/to/ASSEMBLY-demo.vtt \
  --app-url https://VERIFIED_PUBLIC_APP_ORIGIN \
  --source-url https://github.com/VERIFIED_OWNER/VERIFIED_REPOSITORY \
  --output /absolute/private/new-media-build
```

The tool accepts only PNG/JPEG poster data and WebVTT captions, verifies an MP4
container, limits the film to 128 MiB for this bounded media service, and prints a
SHA-256 manifest. It substitutes the verified links and stages exactly eight
allowlisted hosting/media files. Keep the manifest with private release evidence.
The video has no burned captions or title bands. Native captions are optional
and off by default. Media URLs include `?v=0.2.0` to avoid replaying a cached prior film.

The existing dedicated `assembly-media` service account has no project roles.
After publication is authorized, reuse it for this media-only service. Set `ASSEMBLY_MEDIA_BUILD_DIR` to the new directory,
`ASSEMBLY_MEDIA_IMAGE` to a unique Artifact Registry image tag, and the authorized
Google Cloud account/wrapper as documented in the parent deployment README. Run
`./deploy/gcp/media/publish.sh`. The script builds only the isolated context and
publishes `assembly-demo` with minimum 0 / maximum 1, request-based billing, 512 MiB
memory, no secrets and no fixed compute charge. Image/build/traffic usage is extra.

Nginx supplies static byte ranges for seeking. Before sharing the resulting HTTPS
URL, verify anonymous page access, video/mp4, image/png or image/jpeg, text/vtt,
a 206 response with correct Content-Range, and playback/seeking/native captions in
a fresh browser. Compare uploaded asset hashes to the release-approved files.
Do not publish this template with unfilled application/source placeholders.

The published film is available at [ASSEMBLY demo](https://assembly-demo-yuouzcvoaa-uc.a.run.app).
The release service uses minimum 0 / maximum 1 with the dedicated role-free
`assembly-media` account. Anonymous asset MIME types, full SHA-256 matches, and
MP4 byte-range seeking were verified after deployment.

The pinned Nginx container accepts HTTP/2 cleartext on port 8080, and
`publish.sh` enables Cloud Run end-to-end HTTP/2. This permits the larger recorded
walkthrough to download completely; non-streaming HTTP/1 responses have a
32 MiB limit. See [HTTP/2 configuration](https://docs.cloud.google.com/run/docs/configuring/http2)
and [response limits](https://docs.cloud.google.com/run/quotas). Verify a full public
download and hash as well as first/last byte ranges before sharing the player.
The existing Cloud Build identity builds only the isolated eight-file context;
no local Docker daemon or application image build is required.

The v0.2.0 film is 238.033 seconds, 1920 × 1080 at 30 fps, and 92,445,447 bytes.
Its 478-word narration follows new real app actions at 1×, including slow input,
separate supplier and guest decisions, withdrawal, renewed consent and the
completed fictional outcome. One gentle focus keeps the whole guest form visible.
Actual encoded audio measures −14.02 LUFS and −1.31 dBTP. The full corrected
soundtrack passed a model listening review; this is not a claim of human listening.
See the [release verification](../../../RELEASE-VERIFICATION.md) for the exact
file digest, source/release checks and published service verification.
