import torch


class LoRASidecarModule(torch.nn.Module):
    def __init__(self, orig_module: torch.nn.Module, lora_layers: list[torch.nn.Module]):
        super().__init__()
        self._orig_module = orig_module
        self._lora_layers = lora_layers

    def add_lora_layer(self, lora_layer: torch.nn.Module):
        self._lora_layers.append(lora_layer)

    def forward(self, input: torch.Tensor) -> torch.Tensor:
        x = self._orig_module(input)
        for lora_layer in self._lora_layers:
            x += lora_layer(input)
        return x
