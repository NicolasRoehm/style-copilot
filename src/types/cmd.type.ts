export type CustomCmd = 
{
  id          : string;
  description : string;
  prompt      : string;
};

export type CustomAction =
{
  id            : string;
  label         : string;
  prompt        : string;
  loadingLabel ?: string;
}