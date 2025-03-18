import semver from 'semver';

export const apiVersion = (version) => {
  return (req, res, next) => {
    const requestedVersion = req.headers['accept-version'] || '1.0.0';
    
    if (!semver.valid(requestedVersion)) {
      return res.status(400).json({
        error: 'Invalid Version',
        message: 'Please provide a valid semantic version number'
      });
    }

    if (!semver.satisfies(requestedVersion, version)) {
      return res.status(400).json({
        error: 'Version Not Supported',
        message: `API version ${requestedVersion} is not supported. Please use version ${version}`
      });
    }

    req.apiVersion = requestedVersion;
    next();
  };
};

export const deprecatedVersion = (deprecationDate, sunsetDate) => {
  return (req, res, next) => {
    res.set({
      'Deprecation': `date="${deprecationDate}"`,
      'Sunset': sunsetDate,
      'Link': '<https://api.pharmacy-wiki.com/docs>; rel="deprecation"'
    });
    next();
  };
}; 