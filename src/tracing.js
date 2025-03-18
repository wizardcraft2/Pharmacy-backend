// Basic tracing setup
const setupTracing = () => {
  const trace = (message) => {
    console.log(`[${new Date().toISOString()}] ${message}`);
  };

  return {
    trace,
  };
};

export default setupTracing; 