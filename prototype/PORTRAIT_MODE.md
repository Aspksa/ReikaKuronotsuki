# Portrait preview v4

Open `prototype/index.html` and use **Загрузить эталонный портрет** to select the locally saved official image. The viewer validates MIME type and a 15 MB size cap, decodes the image, and uses an in-memory object URL. It never uploads the image to any server, and revokes its object URL upon replacement/removal or page exit.

Choose **SVG-анимация**, **Портрет**, or **Сравнение**. The SVG rig remains functional and separate in SVG or compare mode. A single flattened portrait cannot have independently articulated tails, hair, eyes or ears; true animated portrait mode requires artist-produced transparent layers.

## Known limits
- GitHub repository currently has no checked-in official PNG binary.
- Picker must be used again after reloading the page; intentionally no sensitive image storage.
- Browser/manual visual smoke test still required.
- Existing math tests cover 9-tail controller, not visual fidelity.
