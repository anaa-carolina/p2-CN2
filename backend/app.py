from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2 import service_account
from azure.storage.blob import BlobServiceClient
import io
import os  

app = Flask(__name__, static_folder='dist', static_url_path='/')
CORS(app)

AZURE_ACCOUNT_NAME = "stodsm6p2"
AZURE_ACCOUNT_KEY = "1WOl3UqCWYkSyO8AroooUDGBBEt5G9FOsFGMfWWan6eAHPpA+ulbbXb1iM1u5IZsYfKaAhD8ulYL+ASt3ktC1g=="

AZURE_CONNECTION_STRING = (
    f"DefaultEndpointsProtocol=https;"
    f"AccountName={AZURE_ACCOUNT_NAME};"
    f"AccountKey={AZURE_ACCOUNT_KEY};"
    f"EndpointSuffix=core.windows.net"
)

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/api/list-drive', methods=['POST'])
def list_drive():
    try:
        body = request.get_json(force=True)
        creds = service_account.Credentials.from_service_account_info(
            body['credentials'],
            scopes=['https://www.googleapis.com/auth/drive.readonly']
        )
        service = build('drive', 'v3', credentials=creds)
        folder_id = body.get('folder_id', 'root')
        query = f"'{folder_id}' in parents and trashed = false"
        result = service.files().list(
            q=query,
            fields='files(id, name, mimeType, size, modifiedTime)'
        ).execute()
        files = result.get('files', [])
        return jsonify({'success': True, 'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/list-blob', methods=['POST'])
def list_blob():
    try:
        body = request.get_json(force=True)
        
        # Usando a Connection String fixa com a KEY do professor
        blob_service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
        container_client = blob_service.get_container_client(body['container_name'])
        
        files = []
        for blob in container_client.list_blobs():
            files.append({
                'name': blob.name,
                'size': blob.size,
                'last_modified': blob.last_modified.isoformat() if blob.last_modified else None
            })
        return jsonify({'success': True, 'files': files})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/migrate', methods=['POST'])
def migrate():
    try:
        body = request.get_json(force=True)
        creds = service_account.Credentials.from_service_account_info(
            body['credentials'],
            scopes=['https://www.googleapis.com/auth/drive.readonly']
        )
        service = build('drive', 'v3', credentials=creds)
        
        # Usando a Connection String fixa com a KEY do professor
        blob_service = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
        container_name = body['container_name']
        folder_id = body.get('folder_id', 'root')
        selected_ids = body.get('file_ids', [])

        query = f"'{folder_id}' in parents and trashed = false"
        result = service.files().list(
            q=query,
            fields='files(id, name, mimeType, size)'
        ).execute()
        files = result.get('files', [])

        if selected_ids:
            files = [f for f in files if f['id'] in selected_ids]

        container_client = blob_service.get_container_client(container_name)
        try:
            container_client.create_container()
        except:
            pass

        results = []
        for f in files:
            name = f['name']
            mime = f.get('mimeType', 'application/octet-stream')

            if 'google-apps' in mime:
                results.append({'file': name, 'status': 'skipped', 'reason': 'Formato nativo Google'})
                continue

            try:
                req = service.files().get_media(fileId=f['id'])
                buf = io.BytesIO()
                downloader = MediaIoBaseDownload(buf, req)
                done = False
                while not done:
                    _, done = downloader.next_chunk()
                data = buf.getvalue()
                container_client.get_blob_client(name).upload_blob(data, overwrite=True)
                results.append({'file': name, 'status': 'success', 'size_bytes': len(data)})
            except Exception as e:
                results.append({'file': name, 'status': 'error', 'reason': str(e)})

        ok = sum(1 for r in results if r['status'] == 'success')
        err = sum(1 for r in results if r['status'] == 'error')
        return jsonify({'success': True, 'total': len(results), 'transferred': ok, 'errors': err, 'results': results})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Rotas para servir os arquivos do build do React localmente e em produção
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)