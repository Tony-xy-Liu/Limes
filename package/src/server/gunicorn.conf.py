bind = 'localhost:8001'
# bind = '10.0.0.224:8001'
# bind = '127.0.0.1:8002'
# bind = '192.168.120.68:8001'
# bind = 'sh-lims.microbiology.ubc.ca:8001'

workers = 1
max_requests = 1000
worker_class = 'geventwebsocket.gunicorn.workers.GeventWebSocketWorker'

# CERT_DIR = 'server/certificate/certFiles'
# certfile = '%s/cert.pem'%(CERT_DIR)
# keyfile = '%s/key.pem'%(CERT_DIR)
CERT_DIR = 'server/certificate/certFiles/localhost'
certfile = '%s/for_server.crt'%(CERT_DIR)
keyfile = '%s/for_server.key'%(CERT_DIR)