# Branch data and hosting moves

Branch records are JSON, keyed by a stable branch identifier. The browser loads `/api/branches`; there is no branch list maintained in JavaScript. Adding a branch creates its card and `#/branches/<identifier>` landing page using the shared template and its saved colour, image, introduction, address, service times and contact details.

The local Node server saves `branches.json` in `DATA_DIR` (default `assets/data`) and backs up each previous version under `backups`. Set `DATA_DIR` to persistent storage when hosting Node; retain that directory across deployments.

The hosted Worker adapter saves JSON in bucket storage at `config/branches.json`, with packaged JSON defaults for the first deployment. Export the saved JSON from branch admin before a hosting move, import it on the destination, review and save. The destination validates the same branch fields and checks the current revision before saving.

JSON exports contain references to images, not the images themselves. Migrate `assets/images` and the `uploads` directory too, keeping their URLs, along with other site configuration and backups. For bucket hosting copy the upload objects. Never overwrite current stored configuration with older packaged defaults during deployment.
