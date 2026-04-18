exports.handler = async (event) => {
  const { value } = JSON.parse(event.body);
  const result = value * 0.0085;

  return {
    statusCode: 200,
    body: JSON.stringify({ result })
  };
};
