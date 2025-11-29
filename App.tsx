import React, { useState } from 'react';
import ApiKeySelector from './components/ApiKeySelector';
import CreatorStudio from './components/CreatorStudio';

const App: React.FC = () => {
  const [apiKeySelected, setApiKeySelected] = useState(false);

  return (
    <>
      <ApiKeySelector onKeySelected={() => setApiKeySelected(true)} />
      {apiKeySelected && <CreatorStudio />}
    </>
  );
};

export default App;