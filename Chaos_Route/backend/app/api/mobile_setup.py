"""Page installation + enregistrement mobile / Mobile install + registration page.

Endpoint public (pas de JWT) : le chauffeur scanne le QR avec la camera native,
le navigateur s'ouvre sur cette page qui propose le telechargement de l'APK
et affiche le code d'enregistrement.
"""

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, FileResponse
from pathlib import Path

router = APIRouter()

# Dossier pour stocker l'APK / Directory for APK storage
APK_DIR = Path(__file__).resolve().parent.parent.parent / "apk"


@router.get("/app/setup/{registration_code}", response_class=HTMLResponse)
async def mobile_setup_page(registration_code: str, request: Request):
    """Page d'installation et enregistrement / Install and registration page."""
    base_url = str(request.base_url).rstrip("/")
    apk_exists = (APK_DIR / "cmro-driver.apk").is_file()
    apk_url = f"{base_url}/app/download/cmro-driver.apk" if apk_exists else ""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CMRO Driver — Installation</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0a0a0a; color: #e5e5e5;
            min-height: 100vh; display: flex; justify-content: center; align-items: center;
            padding: 20px;
        }}
        .card {{
            background: #1a1a1a; border: 1px solid #333; border-radius: 16px;
            padding: 32px; max-width: 400px; width: 100%; text-align: center;
        }}
        .logo {{ font-size: 36px; font-weight: bold; color: #f97316; margin-bottom: 4px; }}
        .subtitle {{ font-size: 13px; color: #737373; margin-bottom: 24px; }}
        .step {{
            background: #2a2a2a; border-radius: 10px; padding: 16px; margin-bottom: 12px;
            text-align: left;
        }}
        .step-num {{
            display: inline-block; width: 24px; height: 24px; line-height: 24px;
            text-align: center; border-radius: 50%; background: #f97316;
            color: #fff; font-size: 12px; font-weight: 700; margin-right: 8px;
        }}
        .step-title {{ font-size: 14px; font-weight: 600; color: #e5e5e5; display: inline; }}
        .step-desc {{ font-size: 12px; color: #a3a3a3; margin-top: 6px; margin-left: 32px; }}
        .code-box {{
            background: #2a2a2a; border: 2px solid #f97316; border-radius: 12px;
            padding: 16px; margin: 20px 0;
        }}
        .code-label {{ font-size: 11px; color: #737373; text-transform: uppercase; letter-spacing: 1px; }}
        .code-value {{
            font-size: 32px; font-weight: 800; color: #f97316;
            letter-spacing: 6px; font-family: monospace; margin-top: 4px;
        }}
        .btn {{
            display: block; width: 100%; padding: 14px; border: none; border-radius: 10px;
            font-size: 16px; font-weight: 700; cursor: pointer; text-decoration: none;
            margin-bottom: 10px; text-align: center;
        }}
        .btn-primary {{ background: #f97316; color: #fff; }}
        .btn-secondary {{ background: transparent; border: 1px solid #333; color: #a3a3a3; }}
        .btn:active {{ opacity: 0.8; }}
        .no-apk {{ font-size: 12px; color: #ef4444; margin-bottom: 12px; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">CMRO</div>
        <div class="subtitle">Chaos Manager Route Optimizer — Driver</div>

        <div class="step">
            <span class="step-num">1</span>
            <span class="step-title">Installer l'application</span>
            <div class="step-desc">Telecharger et installer l'app CMRO Driver sur ce telephone.</div>
        </div>

        {'<a href="' + apk_url + '" class="btn btn-primary">Telecharger CMRO Driver</a>' if apk_exists else '<div class="no-apk">APK non disponible — contactez votre administrateur</div>'}

        <div class="step">
            <span class="step-num">2</span>
            <span class="step-title">Enregistrer l'appareil</span>
            <div class="step-desc">Ouvrir l'app et saisir le code ci-dessous.</div>
        </div>

        <div class="code-box">
            <div class="code-label">Code d'enregistrement</div>
            <div class="code-value">{registration_code}</div>
        </div>

        <div class="step">
            <span class="step-num">3</span>
            <span class="step-title">C'est pret !</span>
            <div class="step-desc">Le postier valide l'enregistrement et vous etes operationnel.</div>
        </div>
    </div>
</body>
</html>"""


@router.get("/app/download/{filename}")
async def download_apk(filename: str):
    """Telechargement de l'APK / APK download."""
    # Sanitiser le filename pour eviter path traversal / Sanitize filename to prevent path traversal
    safe_name = Path(filename).name
    if safe_name != filename or ".." in filename:
        return HTMLResponse("<h1>Invalid filename</h1>", status_code=400)
    file_path = APK_DIR / safe_name
    if not file_path.is_file():
        return HTMLResponse("<h1>Fichier non disponible</h1>", status_code=404)
    return FileResponse(
        file_path,
        media_type="application/vnd.android.package-archive",
        filename=safe_name,
    )
