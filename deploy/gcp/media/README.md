# ASSEMBLY demonstration film hosting

This isolated static service serves only the release-reviewed final MP4, poster
and WebVTT captions. Its cream, ink and coral page has native playback controls,
optional English captions, downloads, and verified live-app/source links. It has
no database, VPC connection, provider credentials or application state. The existing
ASSEMBLY application and worker are not modified by this hosting recipe.

Publish only after release review has checked the final media and publication is
authorized. Never upload the film project, captures, plans, transcripts used during
production, or raw provider data. Prepare a new private build directory outside
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
container, limits the film to 30 MiB for Cloud Run HTTP/1 responses, and prints a
SHA-256 manifest. It substitutes the verified links and stages exactly eight
allowlisted hosting/media files. Keep the manifest with private release evidence.
Native captions are optional so they do not duplicate any captions in the film.

After publication is authorized, create a dedicated `assembly-media` service
account with no project roles. Set `ASSEMBLY_MEDIA_BUILD_DIR` to the new directory,
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
