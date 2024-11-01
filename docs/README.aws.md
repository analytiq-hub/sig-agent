# AWS setup

Here are instructions on how to set up an AWS Lightsail instance and deploy the application.

* Create a new Lightsail instance with Ubuntu 24.04 LTS.
    * Assign it a static IP
    * Point your domain to it (in my case, I point both `doc-router.analytiqhub.com` and `api.analytiqhub.com` to it)
* Copy the SSH key to the instance.
* Connect to the instance using SSH.
* Clone the repository.
* Install `Docker` and `nginx`.
* Set up `nginx` to route requests to port 3000 for the doc-router and port 8000 for the API.
  * In my case, I create a file `` as follows:
  ```
  server {
	listen 80;
	server_name doc-router.analytiqhub.com;

	location / {
    	proxy_pass http://localhost:3000; # The port of the doc-router site
    	proxy_http_version 1.1;
    	proxy_set_header Upgrade $http_upgrade;
    	proxy_set_header Connection 'upgrade';
    	proxy_set_header Host $host;
    	proxy_cache_bypass $http_upgrade;
	}
  }

  server {
	listen 80;
	server_name api.analytiqhub.com;

	location / {
    	proxy_pass http://localhost:8000; # The port of the API
    	proxy_http_version 1.1;
    	proxy_set_header Upgrade $http_upgrade;
    	proxy_set_header Connection 'upgrade';
    	proxy_set_header Host $host;
    	proxy_cache_bypass $http_upgrade;
	}
  }
  ```
  * 
  * I then created a new Lightsail container with `nginx` and added the following configuration to the `default.conf` file:
    ```
    server {
      listen 80;
      listen [::]:80;
      server_name doc-router.analytiqhub.com;
      location / { proxy_pass http://<container-ip>:3000; }
    }
    ``` 
    * `sudo ln -s /etc/nginx/sites-available/analytiqhub.conf /etc/nginx/sites-enabled/`
    * `sudo systemctl enable nginx`
    * `sudo systemctl restart nginx`
    * Obtain SSL certificates for the doc-router and the API, in my case:
      ```bash
      sudo certbot --nginx -d doc-router.analytiqhub.com -d api.analytiqhub.com
      ```

* Create a `.env` file at the root of the project with the environment variables listed in `.env.example`.
  * Point the `MONGODB_URI` environment variable to a remote MongoDB server.
  * Set the `NEXTAUTH_URL` environment variable to the URL of the application.
    * In my case, `NEXTAUTH_URL=https://doc-router.analytiqhub.com`
  * Set the `NEXT_PUBLIC_API_URL` environment variable to the URL of the API.
    * In my case, `NEXT_PUBLIC_API_URL=https://api.analytiqhub.com`
* Run the application with Docker Compose.
  ```bash
  docker compose --profile default up --build --detach
  ```
