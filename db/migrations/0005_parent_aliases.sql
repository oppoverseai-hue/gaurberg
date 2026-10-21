-- Parent rule (shared by the batch resolver and the live lookup): units and brands show under their parent, with the unit name in brackets on the map.
update public.companies set aliases = case ticker
  when 'AMZN' then array['AWS','Amazon Web Services','Zoox','Zoox/Amazon']
  when 'MSFT' then array['Azure','Microsoft Azure']
  when 'GOOGL' then array['Google','Google Cloud','Google Cloud Platform','GCP','Waymo','YouTube','Google Maps'] end
where ticker in ('AMZN','MSFT','GOOGL');
