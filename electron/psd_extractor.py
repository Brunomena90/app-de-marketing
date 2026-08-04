import sys
import json
import os
import time
import uuid
from psd_tools import PSDImage

def extract_psd(file_path, temp_dir):
    try:
        psd = PSDImage.open(file_path)
        layers_data = []
        
        def process_layer(layer, parent_x=0, parent_y=0):
            if layer.is_group():
                for child in layer:
                    process_layer(child, parent_x + layer.left, parent_y + layer.top)
            else:
                if layer.width > 0 and layer.height > 0:
                    try:
                        image = layer.topil()
                        if image:
                            # Generate unique filename
                            filename = f"layer_{int(time.time())}_{uuid.uuid4().hex[:8]}.png"
                            output_path = os.path.join(temp_dir, filename)
                            image.save(output_path, "PNG")
                            
                            layers_data.append({
                                "name": layer.name,
                                "x": parent_x + layer.left,
                                "y": parent_y + layer.top,
                                "width": layer.width,
                                "height": layer.height,
                                "opacity": layer.opacity / 255.0,
                                "visible": layer.visible,
                                "url": f"file:///{output_path.replace(chr(92), '/')}"
                            })
                    except Exception as e:
                        pass
        
        for layer in psd:
            process_layer(layer)
            
        return {
            "success": True,
            "width": psd.width,
            "height": psd.height,
            "layers": layers_data
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    temp_dir = sys.argv[2]
    
    result = extract_psd(file_path, temp_dir)
    print(json.dumps(result))
